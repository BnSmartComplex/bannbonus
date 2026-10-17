-- Customer-agreed counteroffer regression; all fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_temp;
create temporary table ids (label text primary key,id uuid not null default gen_random_uuid());
insert into ids(label) values ('tenant'),('customer'),('operator'),('technician');
grant select on ids to authenticated,anon;
create function pg_temp.uid(p text) returns uuid language sql stable as 'select id from pg_temp.ids where label=p';
create function pg_temp.tomorrow(p time) returns timestamptz language sql stable
as $q$ select (((now() at time zone 'Asia/Bangkok')::date+1)+p) at time zone 'Asia/Bangkok' $q$;
insert into auth.users(id) select id from ids where label<>'tenant';
insert into public.tenants(id,name) values(pg_temp.uid('tenant'),'Test service');
insert into public.tenant_memberships(tenant_id,user_id,role) values
(pg_temp.uid('tenant'),pg_temp.uid('operator'),'operator'),
(pg_temp.uid('tenant'),pg_temp.uid('technician'),'technician');
insert into public.technician_capabilities(tenant_id,technician_id,service_area,skill)
values(pg_temp.uid('tenant'),pg_temp.uid('technician'),'NONTHABURI','AIR_CONDITIONER');
select plan(9);
set local role anon;
select lives_ok($q$select public.public_dispatch_overview('NONTHABURI','AIR_CONDITIONER')$q$,'public aggregate status accessible');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid('customer')::text,true);
select is(public.join_operating_tenant_as_customer(),pg_temp.uid('tenant'),'verified customer enrolls');
select lives_ok($q$select public.create_service_request(
 'AIR_CONDITIONER','Detailed test fault description for air conditioner and error.',
 'Verified','AC-01','NONTHABURI','Test Customer','0800000000',array[]::text[],
 true,'41111111-1111-4111-8111-111111111111','BOOKING',pg_temp.tomorrow('10:00'),pg_temp.tomorrow('11:00'))$q$,
 'future Booking can be requested outside service hours');
select set_config('request.jwt.claim.sub',pg_temp.uid('operator')::text,true);
select lives_ok($q$select public.propose_booking_alternative(
 (select id from public.booking_requests where idempotency_key='41111111-1111-4111-8111-111111111111'),
 pg_temp.uid('technician'),pg_temp.tomorrow('12:00'),pg_temp.tomorrow('13:00'))$q$,'operator proposes new slot');
select is((select alternative_status from public.booking_requests where idempotency_key='41111111-1111-4111-8111-111111111111'),
 'PENDING_CUSTOMER','new slot awaits customer consent');
select throws_ok($q$select public.approve_booking_and_assign_technician(
 (select id from public.booking_requests where idempotency_key='41111111-1111-4111-8111-111111111111'),
 pg_temp.uid('technician'),pg_temp.tomorrow('12:00'),pg_temp.tomorrow('13:00'))$q$,
 'P0001','CUSTOMER_ALTERNATIVE_APPROVAL_REQUIRED','backend blocks consent bypass');
select set_config('request.jwt.claim.sub',pg_temp.uid('customer')::text,true);
select lives_ok($q$select public.respond_booking_alternative(
 (select id from public.booking_requests where idempotency_key='41111111-1111-4111-8111-111111111111'),true)$q$,
 'customer accepts proposal');
select set_config('request.jwt.claim.sub',pg_temp.uid('operator')::text,true);
select lives_ok($q$select public.approve_booking_and_assign_technician(
 (select id from public.booking_requests where idempotency_key='41111111-1111-4111-8111-111111111111'),
 pg_temp.uid('technician'),pg_temp.tomorrow('12:00'),pg_temp.tomorrow('13:00'))$q$,
 'operator approves accepted proposal');
select is((select status from public.booking_requests where idempotency_key='41111111-1111-4111-8111-111111111111'),
 'CONFIRMED','confirmed only after customer and operator approval');
reset role;
select * from finish();
rollback;
