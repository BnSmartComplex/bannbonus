-- Test-only fixtures; no customer, coordinate or booking rows remain after rollback.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_temp;
create temporary table ids(label text primary key,id uuid not null default gen_random_uuid());
insert into ids(label) values('tenant'),('customer');
grant select on ids to authenticated;
create function pg_temp.uid(p text) returns uuid language sql stable as
'select id from pg_temp.ids where label=p';
create function pg_temp.tomorrow(p time) returns timestamptz language sql stable
as $q$ select (((now() at time zone 'Asia/Bangkok')::date+1)+p) at time zone 'Asia/Bangkok' $q$;
insert into auth.users(id) select id from ids where label='customer';
insert into public.tenants(id,name) values(pg_temp.uid('tenant'),'Isolated address-intake regression');
select plan(11);

select ok(not has_function_privilege('anon',
 'public.create_chang24_service_request(text,text,text,text,text,text,numeric,numeric,text,text,text[],boolean,uuid,text,timestamptz,timestamptz)',
 'EXECUTE'), 'anonymous cannot call location intake RPC');
select ok(has_function_privilege('authenticated',
 'public.create_chang24_service_request(text,text,text,text,text,text,numeric,numeric,text,text,text[],boolean,uuid,text,timestamptz,timestamptz)',
 'EXECUTE'), 'authenticated role can call location intake RPC');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid('customer')::text,true);
select is(public.join_operating_tenant_as_customer(),pg_temp.uid('tenant'),'customer enrolls once');
select lives_ok($q$select public.create_chang24_service_request(
 'AIR_CONDITIONER','Detailed test fault: air conditioner blows warm air.',
 'Verified','AC-01','BANG_YAI','Long verified-address fixture, Bang Yai',
 13.8692121,100.4110222,'Test Customer','0800000000',array[]::text[],true,
 '0a111111-1111-4111-8111-111111111111','BOOKING',
 pg_temp.tomorrow('10:00'),pg_temp.tomorrow('11:00'))$q$,
 'customer can book with confirmed address and optional GPS');
select is((select service_district from public.booking_requests where idempotency_key='0a111111-1111-4111-8111-111111111111'),
 'BANG_YAI','district stored');
select is((select service_address from public.booking_requests where idempotency_key='0a111111-1111-4111-8111-111111111111'),
 'Long verified-address fixture, Bang Yai','address stored');
select is((select address_verification_status from public.booking_requests where idempotency_key='0a111111-1111-4111-8111-111111111111'),
 'PENDING_OPERATOR_REVIEW','address is not auto-verified');
select is((select road_distance_meters from public.booking_requests where idempotency_key='0a111111-1111-4111-8111-111111111111'),
 null::integer,'distance is not fabricated');
select throws_ok($q$select public.create_chang24_service_request(
 'AIR_CONDITIONER','Detailed test fault: air conditioner blows warm air.',
 'Verified','AC-01','BANGKOK','Long verified-address fixture, Bangkok',
 null,null,'Test Customer','0800000000',array[]::text[],true,
 '0a222222-1111-4111-8111-111111111111','BOOKING',
 pg_temp.tomorrow('10:00'),pg_temp.tomorrow('11:00'))$q$,
 'P0001','SERVICE_AREA_NOT_SUPPORTED','out-of-zone requests denied');
select throws_ok($q$select public.create_chang24_service_request(
 'AIR_CONDITIONER','Detailed test fault: air conditioner blows warm air.',
 'Verified','AC-01','BANG_YAI','',
 null,null,'Test Customer','0800000000',array[]::text[],true,
 '0a333333-1111-4111-8111-111111111111','BOOKING',
 pg_temp.tomorrow('10:00'),pg_temp.tomorrow('11:00'))$q$,
 'P0001','SERVICE_ADDRESS_REQUIRED','missing address denied');
select throws_ok($q$select public.create_chang24_service_request(
 'AIR_CONDITIONER','Detailed test fault: air conditioner blows warm air.',
 'Verified','AC-01','BANG_BUA_THONG','Long verified-address fixture, Bang Bua Thong',
 13.8692121,null,'Test Customer','0800000000',array[]::text[],true,
 '0a444444-1111-4111-8111-111111111111','BOOKING',
 pg_temp.tomorrow('10:00'),pg_temp.tomorrow('11:00'))$q$,
 'P0001','INVALID_CUSTOMER_COORDINATES','half-null coordinate pair denied');
reset role;
select * from finish();
rollback;
