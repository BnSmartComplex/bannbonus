-- Database-only checks. Run against a local stack or approved, isolated test project.
-- The outer transaction is rolled back; never execute this file in Production.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select plan(25);

select ok(
  to_regclass('public.tenants') is not null
  and to_regclass('public.tenant_memberships') is not null
  and to_regclass('public.booking_requests') is not null
  and to_regclass('public.booking_photos') is not null
  and to_regclass('public.research_outbox') is not null
  and to_regclass('public.audit_logs') is not null,
  'starter tables exist'
);

select ok(
  (select bool_and(c.relrowsecurity)
   from pg_class c
   where c.oid in (
     'public.tenants'::regclass,
     'public.tenant_memberships'::regclass,
     'public.booking_requests'::regclass,
     'public.booking_photos'::regclass,
     'public.research_outbox'::regclass,
     'public.audit_logs'::regclass
   )),
  'RLS is enabled on every starter table'
);

select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.booking_requests'::regclass
            and conname = 'booking_requests_customer_idempotency_unique'
            and contype = 'u'),
  'customer idempotency key is unique'
);
select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.booking_requests'::regclass
            and conname = 'booking_requests_id_tenant_unique'
            and contype = 'u'),
  'booking ID and tenant have a composite unique constraint'
);
select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.booking_photos'::regclass
            and contype = 'f'
            and pg_get_constraintdef(oid) like '%(booking_id, tenant_id)%'),
  'photo metadata has a composite booking/tenant foreign key'
);
select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.research_outbox'::regclass
            and contype = 'f'
            and pg_get_constraintdef(oid) like '%(booking_id, tenant_id)%'),
  'research outbox has a composite booking/tenant foreign key'
);
select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.audit_logs'::regclass
            and contype = 'f'
            and pg_get_constraintdef(oid) like '%(entity_id, tenant_id)%'),
  'audit log has a composite entity/tenant foreign key'
);

select ok(has_table_privilege('authenticated', 'public.booking_requests', 'SELECT'),
          'authenticated role has only the policy-protected read surface');
select ok(not has_table_privilege('anon', 'public.booking_requests', 'SELECT'),
          'anon role cannot read booking requests');
select ok(not has_table_privilege('authenticated', 'public.booking_requests', 'INSERT'),
          'authenticated role cannot bypass the RPC with direct inserts');
select ok(not has_table_privilege('authenticated', 'public.booking_requests', 'UPDATE'),
          'authenticated role cannot update booking requests directly');
select ok(not has_table_privilege('authenticated', 'public.booking_requests', 'DELETE'),
          'authenticated role cannot delete booking requests directly');
select ok(not has_table_privilege('service_role', 'public.booking_requests', 'SELECT'),
          'service_role has no explicit starter table grant');
select ok(not has_table_privilege('authenticated', 'public.research_outbox', 'SELECT'),
          'authenticated role cannot read the internal research outbox');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'SELECT'),
          'authenticated role cannot read the internal audit log');

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_booking_request(text,text,text,text,text,text,text,text[],boolean,uuid)',
    'EXECUTE'
  ),
  'authenticated role can call the booking RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_booking_request(text,text,text,text,text,text,text,text[],boolean,uuid)',
    'EXECUTE'
  ),
  'anon role cannot call the booking RPC'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.create_booking_request(text,text,text,text,text,text,text,text[],boolean,uuid)',
    'EXECUTE'
  ),
  'service_role has no explicit booking RPC grant'
);
select ok(
  exists (
    select 1 from pg_proc p
    where p.oid = 'public.create_booking_request(text,text,text,text,text,text,text,text[],boolean,uuid)'::regprocedure
      and p.prosecdef
      and position('search_path=""' in coalesce(array_to_string(p.proconfig, ','), '')) > 0
  ),
  'booking RPC is SECURITY DEFINER with an empty search_path'
);

select ok(
  exists (select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'booking_requests'
            and policyname = 'customer or staff read requests'
            and cmd = 'SELECT'),
  'booking queue has the expected read policy'
);
select ok(
  exists (select 1 from storage.buckets
          where id = 'equipment-photos'
            and name = 'equipment-photos'
            and public = false
            and file_size_limit = 5000000
            and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]),
  'equipment photo bucket is private and uses the expected limits'
);
select ok(
  exists (select 1 from pg_policies
          where schemaname = 'storage'
            and tablename = 'objects'
            and policyname = 'customer uploads own equipment photos'
            and cmd = 'INSERT')
  and exists (select 1 from pg_policies
              where schemaname = 'storage'
                and tablename = 'objects'
                and policyname = 'customer reads own equipment photos'
                and cmd = 'SELECT'),
  'Storage policies exist for owner-scoped upload and read'
);

select ok(
  exists (select 1 from pg_policies
          where schemaname = 'public'
            and tablename = 'research_outbox'
            and policyname = 'deny direct access to research outbox'
            and cmd = 'ALL'
            and qual = 'false'
            and with_check = 'false')
  and exists (select 1 from pg_policies
              where schemaname = 'public'
                and tablename = 'audit_logs'
                and policyname = 'deny direct access to audit logs'
                and cmd = 'ALL'
                and qual = 'false'
                and with_check = 'false'),
  'internal outbox and audit tables have explicit deny policies'
);

select ok(
  to_regclass('public.tenant_memberships_user_id_idx') is not null
  and to_regclass('public.booking_photos_booking_id_tenant_id_idx') is not null
  and to_regclass('public.booking_photos_tenant_id_idx') is not null
  and to_regclass('public.research_outbox_booking_id_tenant_id_idx') is not null
  and to_regclass('public.research_outbox_tenant_id_idx') is not null
  and to_regclass('public.audit_logs_actor_id_idx') is not null
  and to_regclass('public.audit_logs_entity_id_tenant_id_idx') is not null
  and to_regclass('public.audit_logs_tenant_id_idx') is not null,
  'foreign keys have supporting indexes'
);

select ok(
  (select bool_and(position('SELECT auth.uid()' in coalesce(qual, with_check, '')) > 0)
   from pg_policies
   where policyname in (
     'members can view own membership',
     'members can view own tenant',
     'customer or staff read requests',
     'customer or staff read photo metadata',
     'customer uploads own equipment photos',
     'customer reads own equipment photos'
   )),
  'user-scoped RLS policies evaluate auth.uid() with an initplan'
);

select * from finish();
rollback;
