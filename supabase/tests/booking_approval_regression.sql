-- Database-only tests: isolated Supabase project with migrations 0001/0002 loaded.
-- pg_prove supplies TAP failure detection; all fixtures and extension changes roll back.
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
create temporary table booking_test_ids (label text primary key, id uuid not null default gen_random_uuid());
insert into booking_test_ids(label) values ('tenant_a'),('tenant_b'),('operator'),('other_operator'),('technician'),('customer'),('booking_a'),('booking_b'),('booking_c'),('booking_d');
grant select on booking_test_ids to authenticated;
create function pg_temp.test_id(p_label text) returns uuid language sql stable as 'select id from pg_temp.booking_test_ids where label = p_label';
insert into auth.users(id) select id from booking_test_ids where label in ('operator','other_operator','technician','customer');
insert into public.tenants(id,name) select id,'rollback-only booking regression' from booking_test_ids where label in ('tenant_a','tenant_b');
insert into public.tenant_memberships(tenant_id,user_id,role) values
(pg_temp.test_id('tenant_a'),pg_temp.test_id('operator'),'operator'),
(pg_temp.test_id('tenant_b'),pg_temp.test_id('operator'),'operator'),
(pg_temp.test_id('tenant_b'),pg_temp.test_id('other_operator'),'operator'),
(pg_temp.test_id('tenant_a'),pg_temp.test_id('technician'),'technician'),
(pg_temp.test_id('tenant_b'),pg_temp.test_id('technician'),'technician'),
(pg_temp.test_id('tenant_a'),pg_temp.test_id('customer'),'customer');
insert into public.booking_requests(id,tenant_id,customer_id,category,fault_description,area,contact_name,contact_phone,idempotency_key)
select id,pg_temp.test_id(case when label='booking_c' then 'tenant_b' else 'tenant_a' end),
pg_temp.test_id('customer'),'OTHER','Database regression test description only','BANGKOK','Regression','0800000000',gen_random_uuid()
from booking_test_ids where label in ('booking_a','booking_b','booking_c','booking_d');

select plan(27);
set local role authenticated;
select is(public.booking_price_baht('2026-10-17T10:00:00+07'),299,'10:00 day boundary');
select is(public.booking_price_baht('2026-10-17T20:59:59+07'),299,'20:59 day boundary');
select is(public.booking_price_baht('2026-10-17T21:00:00+07'),499,'21:00 night boundary');
select is(public.booking_price_baht('2026-10-18T01:59:59+07'),499,'01:59 night boundary');
select throws_ok($q$select public.booking_price_baht('2026-10-18T02:00:00+07')$q$,'P0001','OUTSIDE_SERVICE_PRICE_WINDOW','02:00 closed');
select set_config('request.jwt.claim.sub','',true);
select throws_ok($q$select public.approve_booking_and_assign_technician(pg_temp.test_id('booking_a'),pg_temp.test_id('technician'),'2026-10-17T10:00+07','2026-10-17T11:00+07')$q$,'P0001','UNAUTHENTICATED','no actor denied');
select set_config('request.jwt.claim.sub',pg_temp.test_id('customer')::text,true);
select throws_ok($q$select public.approve_booking_and_assign_technician(pg_temp.test_id('booking_a'),pg_temp.test_id('technician'),'2026-10-17T10:00+07','2026-10-17T11:00+07')$q$,'P0001','OPERATOR_FORBIDDEN','customer cannot approve');
select set_config('request.jwt.claim.sub',pg_temp.test_id('other_operator')::text,true);
select throws_ok($q$select public.approve_booking_and_assign_technician(pg_temp.test_id('booking_a'),pg_temp.test_id('technician'),'2026-10-17T10:00+07','2026-10-17T11:00+07')$q$,'P0001','OPERATOR_FORBIDDEN','other tenant operator denied');
select set_config('request.jwt.claim.sub',pg_temp.test_id('operator')::text,true);
select lives_ok($q$select public.approve_booking_and_assign_technician(pg_temp.test_id('booking_a'),pg_temp.test_id('technician'),'2026-10-17T10:00+07','2026-10-17T11:00+07')$q$,'first approval succeeds');
select is((select status from public.booking_requests where id=pg_temp.test_id('booking_a')),'CONFIRMED','booking confirmed');
select lives_ok($q$select public.approve_booking_and_assign_technician(pg_temp.test_id('booking_a'),pg_temp.test_id('technician'),'2026-10-17T10:00+07','2026-10-17T11:00+07')$q$,'exact retry succeeds');
select throws_ok($q$select public.approve_booking_and_assign_technician(pg_temp.test_id('booking_a'),pg_temp.test_id('technician'),'2026-10-17T12:00+07','2026-10-17T13:00+07')$q$,'P0001','APPROVAL_RETRY_MISMATCH','different payload cannot masquerade as retry');
select throws_ok($q$select public.approve_booking_and_assign_technician(pg_temp.test_id('booking_b'),pg_temp.test_id('technician'),'2026-10-17T10:30+07','2026-10-17T11:30+07')$q$,'P0001','TECHNICIAN_TIME_CONFLICT','same tenant overlap denied');
select throws_ok($q$select public.approve_booking_and_assign_technician(pg_temp.test_id('booking_c'),pg_temp.test_id('technician'),'2026-10-17T10:30+07','2026-10-17T11:30+07')$q$,'P0001','TECHNICIAN_TIME_CONFLICT','shared technician cross-tenant overlap denied');
select lives_ok($q$select public.approve_booking_and_assign_technician(pg_temp.test_id('booking_b'),pg_temp.test_id('technician'),'2026-10-17T11:00+07','2026-10-17T12:00+07')$q$,'adjacent half-open interval allowed');
select throws_ok($q$select public.approve_booking_and_assign_technician(pg_temp.test_id('booking_d'),pg_temp.test_id('technician'),null,'2026-10-17T12:00+07')$q$,'P0001','INVALID_TIME_RANGE','null range denied explicitly');
select throws_ok($q$select public.approve_booking_and_assign_technician(pg_temp.test_id('booking_d'),pg_temp.test_id('technician'),'2026-10-17T12:00+07','infinity')$q$,'P0001','INVALID_TIME_RANGE','infinite range denied');

select set_config('request.jwt.claim.sub',pg_temp.test_id('other_operator')::text,true);
select is((select count(*) from public.booking_appointments where tenant_id=pg_temp.test_id('tenant_a')),0::bigint,'cross-tenant appointments hidden by RLS');
select is((select count(*) from public.booking_requests where tenant_id=pg_temp.test_id('tenant_a')),0::bigint,'cross-tenant bookings hidden by RLS');
select set_config('request.jwt.claim.sub',pg_temp.test_id('customer')::text,true);
select is((select count(*) from public.booking_appointments where booking_id=pg_temp.test_id('booking_a')),1::bigint,'customer sees own appointment');
select throws_ok($q$update public.booking_appointments set status='COMPLETED' where booking_id=pg_temp.test_id('booking_a')$q$,'42501',null,'direct appointment writes denied');
select set_config('request.jwt.claim.sub',pg_temp.test_id('technician')::text,true);
select is((select count(*) from public.booking_appointments where booking_id=pg_temp.test_id('booking_a')),1::bigint,'assigned technician sees appointment');
reset role;
select is((select count(*) from public.audit_logs where entity_id=pg_temp.test_id('booking_a') and action='BOOKING_APPROVED_AND_ASSIGNED'),1::bigint,'retry creates exactly one audit record');
select is((select status from public.booking_requests where id=pg_temp.test_id('booking_c')),'PENDING_TEAM_REVIEW','rejected overlap leaves booking pending');

select throws_ok($q$insert into public.booking_appointments
(booking_id,tenant_id,technician_id,scheduled_start,scheduled_end,price_baht,created_by)
values (pg_temp.test_id('booking_c'),pg_temp.test_id('tenant_b'),pg_temp.test_id('technician'),
'2026-10-17T10:30+07','2026-10-17T11:30+07',299,pg_temp.test_id('operator'))$q$,
'23P01',null,'database constraint rejects overlap even when bypassing RPC');
insert into pg_temp.booking_test_ids(label,id) select 'appointment_a',id from public.booking_appointments where booking_id=pg_temp.test_id('booking_a');
delete from public.tenant_memberships where tenant_id=pg_temp.test_id('tenant_a') and user_id=pg_temp.test_id('technician');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.test_id('technician')::text,true);
select throws_ok($q$select public.technician_update_appointment_status(
pg_temp.test_id('appointment_a'),'ACCEPTED')$q$,
'P0001','TECHNICIAN_FORBIDDEN','revoked membership cannot update assignment');
select throws_ok($q$select public.technician_update_appointment_status(
pg_temp.test_id('booking_a'),null)$q$,'P0001','INVALID_APPOINTMENT_STATUS','null appointment status rejected');
reset role;
select * from finish();

rollback;
