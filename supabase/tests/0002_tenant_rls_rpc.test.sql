-- RLS/RPC behavior checks with synthetic identities. Run only on a disposable local stack.
-- All fixture writes are enclosed in a transaction and rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select plan(19);

-- Fixed identities are safe only because this file is intended for a fresh local test database.
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'customer-a@chang24-test.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'customer-b@chang24-test.invalid'),
  ('10000000-0000-4000-8000-000000000003', 'operator-a@chang24-test.invalid'),
  ('10000000-0000-4000-8000-000000000004', 'operator-b@chang24-test.invalid'),
  ('10000000-0000-4000-8000-000000000005', 'tenant-admin-a@chang24-test.invalid'),
  ('10000000-0000-4000-8000-000000000006', 'technician-a@chang24-test.invalid'),
  ('10000000-0000-4000-8000-000000000007', 'ambiguous-customer@chang24-test.invalid'),
  ('10000000-0000-4000-8000-000000000008', 'no-membership@chang24-test.invalid');

insert into public.tenants (id, name) values
  ('20000000-0000-4000-8000-000000000001', 'Test Tenant A'),
  ('20000000-0000-4000-8000-000000000002', 'Test Tenant B');

insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'customer'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'customer'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'operator'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'operator'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'tenant_admin'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'technician'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'customer'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000007', 'customer');

insert into public.booking_requests (
  id, tenant_id, customer_id, category, fault_description, brand, model_number,
  area, contact_name, contact_phone, idempotency_key
) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001', 'OTHER',
   'Synthetic test booking A with enough details.', 'Test', 'A-1', 'BANGKOK',
   'Test Customer A', '0000000000', '40000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000002', 'OTHER',
   'Synthetic test booking B with enough details.', 'Test', 'B-1', 'NONTHABURI',
   'Test Customer B', '0000000001', '40000000-0000-4000-8000-000000000002');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select is((select count(*) from public.booking_requests), 1::bigint,
          'customer A sees only their own tenant booking');
select is((select count(*) from public.booking_requests where id = '30000000-0000-4000-8000-000000000002'), 0::bigint,
          'customer A cannot see customer B booking');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
select is((select count(*) from public.booking_requests), 1::bigint,
          'customer B sees only their own tenant booking');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000003';
select is((select count(*) from public.booking_requests where id = '30000000-0000-4000-8000-000000000001'), 1::bigint,
          'operator A sees tenant A booking');
select is((select count(*) from public.booking_requests where id = '30000000-0000-4000-8000-000000000002'), 0::bigint,
          'operator A cannot see tenant B booking');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000004';
select is((select count(*) from public.booking_requests where id = '30000000-0000-4000-8000-000000000002'), 1::bigint,
          'operator B sees tenant B booking');
select is((select count(*) from public.booking_requests where id = '30000000-0000-4000-8000-000000000001'), 0::bigint,
          'operator B cannot see tenant A booking');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000005';
select is((select count(*) from public.booking_requests where id = '30000000-0000-4000-8000-000000000001'), 1::bigint,
          'tenant admin A sees tenant A booking');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000006';
select is((select count(*) from public.booking_requests), 0::bigint,
          'technician cannot read the general booking queue');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.create_booking_request(
    'UNLISTED', 'Synthetic test description with enough characters.', 'Test', 'C-1',
    'BANGKOK', 'Test Customer A', '0000000000', array[]::text[], true,
    '50000000-0000-4000-8000-000000000002'
  )$$,
  'P0001', 'VALIDATION_ERROR', 'RPC rejects an unlisted equipment category'
);

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000007';
select throws_ok(
  $$select public.create_booking_request(
    'OTHER', 'Synthetic ambiguous membership test description.', 'Test', 'D-1',
    'BANGKOK', 'Test Ambiguous', '0000000000', array[]::text[], true,
    '50000000-0000-4000-8000-000000000003'
  )$$,
  'P0001', 'SINGLE_CUSTOMER_MEMBERSHIP_REQUIRED', 'RPC rejects multiple customer memberships'
);
select is((select count(*) from public.booking_requests
           where customer_id = '10000000-0000-4000-8000-000000000007'), 0::bigint,
          'ambiguous membership rejection creates no booking');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.create_booking_request(
    'OTHER', 'Synthetic foreign photo ownership test.', 'Test', 'E-1',
    'BANGKOK', 'Test Customer A', '0000000000',
    array['10000000-0000-4000-8000-000000000002/not-owned.png'], true,
    '50000000-0000-4000-8000-000000000004'
  )$$,
  'P0001', 'INVALID_PHOTO', 'RPC rejects a photo path owned by another user'
);

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000008';
select throws_ok(
  $$select public.create_booking_request(
    'OTHER', 'Synthetic missing membership test description.', 'Test', 'F-1',
    'BANGKOK', 'Test No Membership', '0000000000', array[]::text[], true,
    '50000000-0000-4000-8000-000000000005'
  )$$,
  'P0001', 'SINGLE_CUSTOMER_MEMBERSHIP_REQUIRED', 'RPC rejects a user with no customer membership'
);

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select is(
  public.create_booking_request(
    'OTHER', 'Synthetic idempotency integration test description.', 'Test', 'IDEM-1',
    'BANGKOK', 'Test Customer A', '0000000000', array[]::text[], true,
    '50000000-0000-4000-8000-000000000001'
  ),
  public.create_booking_request(
    'OTHER', 'Synthetic idempotency integration test description.', 'Test', 'IDEM-1',
    'BANGKOK', 'Test Customer A', '0000000000', array[]::text[], true,
    '50000000-0000-4000-8000-000000000001'
  ),
  'retry with the same idempotency key returns the same booking ID'
);
reset role;
select is((select count(*) from public.booking_requests
           where customer_id = '10000000-0000-4000-8000-000000000001'
             and idempotency_key = '50000000-0000-4000-8000-000000000001'), 1::bigint,
          'idempotent retry creates one booking');
select is((select count(*) from public.research_outbox
           where booking_id = (select id from public.booking_requests
                               where customer_id = '10000000-0000-4000-8000-000000000001'
                                 and idempotency_key = '50000000-0000-4000-8000-000000000001')),
          1::bigint, 'idempotent retry creates one research outbox event');
select is((select count(*) from public.audit_logs
           where entity_id = (select id from public.booking_requests
                              where customer_id = '10000000-0000-4000-8000-000000000001'
                                and idempotency_key = '50000000-0000-4000-8000-000000000001')),
          1::bigint, 'idempotent retry creates one audit record');
select is((select status from public.booking_requests
           where customer_id = '10000000-0000-4000-8000-000000000001'
             and idempotency_key = '50000000-0000-4000-8000-000000000001'),
          'PENDING_TEAM_REVIEW'::text, 'RPC never confirms the booking automatically');

reset role;
select * from finish();
rollback;
