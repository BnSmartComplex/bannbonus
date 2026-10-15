-- Read-only security/configuration snapshot. Returns no booking, user, or customer records.
-- Run only after the schema exists in an authorized test environment.
begin read only;

select n.nspname as schema_name,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('tenants', 'tenant_memberships', 'booking_requests',
                    'booking_photos', 'research_outbox', 'audit_logs')
order by c.relname;

select role_name,
       has_table_privilege(role_name, 'public.booking_requests', 'SELECT') as can_select,
       has_table_privilege(role_name, 'public.booking_requests', 'INSERT') as can_insert,
       has_table_privilege(role_name, 'public.booking_requests', 'UPDATE') as can_update,
       has_table_privilege(role_name, 'public.booking_requests', 'DELETE') as can_delete
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
order by role_name;

select p.policyname, p.schemaname, p.tablename, p.cmd, p.roles, p.qual, p.with_check
from pg_policies p
where (p.schemaname = 'public' and p.tablename in
       ('tenants', 'tenant_memberships', 'booking_requests', 'booking_photos', 'research_outbox', 'audit_logs'))
   or (p.schemaname = 'storage' and p.tablename = 'objects'
       and p.policyname in ('customer uploads own equipment photos', 'customer reads own equipment photos'))
order by p.schemaname, p.tablename, p.policyname;

select p.oid::regprocedure as function_signature,
       p.prosecdef as security_definer,
       p.proconfig as function_settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
where p.oid = to_regprocedure(
  'public.create_booking_request(text,text,text,text,text,text,text,text[],boolean,uuid)'
);

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'equipment-photos';

rollback;
