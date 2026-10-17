-- C1 regression tests. Run only after migrations 0001-0004 on an isolated database.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
create temporary table c1_ids(label text primary key, id uuid not null default gen_random_uuid());
insert into c1_ids(label) values
  ('tenant'), ('operator'), ('technician'), ('customer'), ('booking'), ('appointment'),
  ('dispatch_booking'), ('conflict_booking');
create function pg_temp.c1_id(p_label text) returns uuid language sql stable
as 'select id from pg_temp.c1_ids where label = p_label';
grant select on c1_ids to authenticated;
insert into auth.users(id) select id from c1_ids where label in ('operator', 'technician', 'customer');
insert into public.tenants(id, name) values (pg_temp.c1_id('tenant'), 'C1 isolated tenant');
insert into public.tenant_memberships(tenant_id, user_id, role) values
  (pg_temp.c1_id('tenant'), pg_temp.c1_id('operator'), 'operator'),
  (pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'technician'),
  (pg_temp.c1_id('tenant'), pg_temp.c1_id('customer'), 'customer');
insert into public.booking_requests(
  id, tenant_id, customer_id, category, fault_description, area,
  contact_name, contact_phone, idempotency_key
) values
  (pg_temp.c1_id('booking'), pg_temp.c1_id('tenant'), pg_temp.c1_id('customer'),
   'AIR_CONDITIONER', 'C1 synthetic booking for availability testing.', 'BANGKOK',
   'C1 Customer', '0800000000', gen_random_uuid()),
  (pg_temp.c1_id('dispatch_booking'), pg_temp.c1_id('tenant'), pg_temp.c1_id('customer'),
   'AIR_CONDITIONER', 'C1 synthetic dispatch booking for eligibility testing.', 'BANGKOK',
   'C1 Customer', '0800000000', gen_random_uuid()),
  (pg_temp.c1_id('conflict_booking'), pg_temp.c1_id('tenant'), pg_temp.c1_id('customer'),
   'AIR_CONDITIONER', 'C1 synthetic conflict booking for eligibility testing.', 'BANGKOK',
   'C1 Customer', '0800000000', gen_random_uuid());
insert into public.booking_appointments(
  id, booking_id, tenant_id, technician_id, scheduled_start, scheduled_end,
  estimated_dispatch_fee_baht, created_by
) values (
  pg_temp.c1_id('appointment'), pg_temp.c1_id('booking'), pg_temp.c1_id('tenant'),
  pg_temp.c1_id('technician'), now() + interval '2 hours', now() + interval '3 hours',
  299, pg_temp.c1_id('operator'));
select plan(23);

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.c1_id('customer')::text, true);
select throws_ok(
  $q$select public.set_technician_presence(pg_temp.c1_id('tenant'), 'ONLINE')$q$,
  'P0001', 'TECHNICIAN_FORBIDDEN', 'customer cannot change technician presence'
);
select throws_ok(
  $q$select * from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER',
    now() + interval '4 hours', now() + interval '5 hours')$q$,
  'P0001', 'ELIGIBILITY_FORBIDDEN', 'customer cannot inspect dispatch eligibility'
);

select set_config('request.jwt.claim.sub', pg_temp.c1_id('operator')::text, true);
select is(
  (select presence_status from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER',
    now() + interval '4 hours', now() + interval '5 hours')),
  'OFFLINE', 'missing presence is treated as offline'
);
select is(
  (select is_available from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER',
    now() + interval '4 hours', now() + interval '5 hours')),
  false, 'offline technician is not available'
);

reset role;
insert into public.technician_capabilities(tenant_id, technician_id, service_area, skill)
values (pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER');
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.c1_id('technician')::text, true);
select lives_ok(
  $q$select public.set_technician_presence(pg_temp.c1_id('tenant'), 'ONLINE')$q$,
  'technician can set ONLINE presence'
);
select set_config('request.jwt.claim.sub', pg_temp.c1_id('operator')::text, true);
select is(
  (select is_available from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER',
    now() + interval '4 hours', now() + interval '5 hours')),
  true, 'online fresh capable technician is available'
);
select is(
  (select reasons from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER',
    now() + interval '4 hours', now() + interval '5 hours')),
  array[]::text[], 'eligible technician has no blockers'
);

reset role;
update public.technician_presence
set last_seen_at = now() - interval '6 minutes', updated_at = now() - interval '6 minutes'
where tenant_id = pg_temp.c1_id('tenant') and technician_id = pg_temp.c1_id('technician');
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.c1_id('operator')::text, true);
select is(
  (select presence_is_fresh from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER',
    now() + interval '4 hours', now() + interval '5 hours')),
  false, 'stale presence is rejected'
);
select is(
  (select 'PRESENCE_STALE' = any(reasons) from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER',
    now() + interval '4 hours', now() + interval '5 hours')),
  true, 'stale presence returns an explicit blocker'
);
select set_config('request.jwt.claim.sub', pg_temp.c1_id('technician')::text, true);
select lives_ok(
  $q$select public.set_technician_presence(pg_temp.c1_id('tenant'), 'ONLINE')$q$,
  'technician refreshes presence heartbeat'
);

select set_config('request.jwt.claim.sub', pg_temp.c1_id('operator')::text, true);
select is(
  (select has_conflicting_booking from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER',
    now() + interval '2 hours 30 minutes', now() + interval '2 hours 45 minutes')),
  true, 'overlapping appointment is a conflict'
);
select is(
  (select is_available from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER',
    now() + interval '2 hours 30 minutes', now() + interval '2 hours 45 minutes')),
  false, 'overlapping appointment blocks availability'
);
select is(
  (select area_match from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'NONTHABURI', 'AIR_CONDITIONER',
    now() + interval '4 hours', now() + interval '5 hours')),
  false, 'unsupported service area blocks eligibility'
);
select is(
  (select skill_match from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'PLUMBING',
    now() + interval '4 hours', now() + interval '5 hours')),
  false, 'unsupported skill blocks eligibility'
);

select set_config('request.jwt.claim.sub', pg_temp.c1_id('technician')::text, true);
select throws_ok(
  $q$select public.technician_check_in(pg_temp.c1_id('appointment'))$q$,
  'P0001', 'CHECK_IN_REQUIRES_ACCEPTED', 'check-in cannot skip accepted state'
);
reset role;
update public.booking_appointments set status = 'ACCEPTED'
where id = pg_temp.c1_id('appointment');
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.c1_id('technician')::text, true);
select lives_ok(
  $q$select public.technician_check_in(pg_temp.c1_id('appointment'))$q$,
  'accepted technician can check in'
);
select set_config('request.jwt.claim.sub', pg_temp.c1_id('operator')::text, true);
select is(
  (select has_active_visit from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER',
    now() + interval '4 hours', now() + interval '5 hours')),
  true, 'active visit blocks dispatch'
);
select set_config('request.jwt.claim.sub', pg_temp.c1_id('technician')::text, true);
select lives_ok(
  $q$select public.technician_check_out(pg_temp.c1_id('appointment'))$q$,
  'technician can check out'
);
select set_config('request.jwt.claim.sub', pg_temp.c1_id('operator')::text, true);
select is(
  (select has_active_visit from public.get_technician_dispatch_eligibility(
    pg_temp.c1_id('tenant'), pg_temp.c1_id('technician'), 'BANGKOK', 'AIR_CONDITIONER',
    now() + interval '4 hours', now() + interval '5 hours')),
  false, 'checked-out visit no longer blocks dispatch'
);

select lives_ok(
  $q$select public.dispatch_and_assign_technician(
    pg_temp.c1_id('dispatch_booking'), pg_temp.c1_id('technician'),
    now() + interval '4 hours', now() + interval '5 hours')$q$,
  'eligible technician can be dispatched atomically'
);
select throws_ok(
  $q$select public.dispatch_and_assign_technician(
    pg_temp.c1_id('conflict_booking'), pg_temp.c1_id('technician'),
    now() + interval '4 hours 30 minutes', now() + interval '5 hours 30 minutes')$q$,
  'P0001', 'DISPATCH_INELIGIBLE:ACTIVE_ASSIGNMENT,SCHEDULE_CONFLICT',
  'dispatch conflict is rejected with all relevant blockers'
);
select is(
  (select count(*) from public.booking_appointments where booking_id = pg_temp.c1_id('dispatch_booking')),
  1::bigint, 'atomic dispatch creates one appointment'
);
select is(
  (select status from public.booking_requests where id = pg_temp.c1_id('dispatch_booking')),
  'CONFIRMED', 'atomic dispatch confirms only the winning booking'
);
select * from finish();
rollback;
