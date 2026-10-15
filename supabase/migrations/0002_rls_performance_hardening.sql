-- Improve lookup performance and preserve default-deny behavior for internal tables.
-- Apply only after 0001_initial.sql, first in an isolated test project.

create index if not exists tenant_memberships_user_id_idx
  on public.tenant_memberships(user_id);
create index if not exists booking_photos_booking_id_tenant_id_idx
  on public.booking_photos(booking_id, tenant_id);
create index if not exists booking_photos_tenant_id_idx
  on public.booking_photos(tenant_id);
create index if not exists research_outbox_booking_id_tenant_id_idx
  on public.research_outbox(booking_id, tenant_id);
create index if not exists research_outbox_tenant_id_idx
  on public.research_outbox(tenant_id);
create index if not exists audit_logs_actor_id_idx
  on public.audit_logs(actor_id);
create index if not exists audit_logs_entity_id_tenant_id_idx
  on public.audit_logs(entity_id, tenant_id);
create index if not exists audit_logs_tenant_id_idx
  on public.audit_logs(tenant_id);

-- Keep internal audit and outbox tables inaccessible even if a future migration
-- accidentally grants Data API privileges to anon or authenticated.
drop policy if exists "deny direct access to research outbox" on public.research_outbox;
create policy "deny direct access to research outbox" on public.research_outbox
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "deny direct access to audit logs" on public.audit_logs;
create policy "deny direct access to audit logs" on public.audit_logs
  for all to anon, authenticated using (false) with check (false);

-- Wrap auth.uid() in a scalar subquery so Postgres evaluates it once per query
-- rather than once for each row considered by the RLS policy.
drop policy if exists "members can view own membership" on public.tenant_memberships;
create policy "members can view own membership" on public.tenant_memberships
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "members can view own tenant" on public.tenants;
create policy "members can view own tenant" on public.tenants
  for select to authenticated using (
    exists (
      select 1 from public.tenant_memberships m
      where m.tenant_id = id and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "customer or staff read requests" on public.booking_requests;
create policy "customer or staff read requests" on public.booking_requests
  for select to authenticated using (
    customer_id = (select auth.uid())
    or exists (
      select 1 from public.tenant_memberships m
      where m.tenant_id = booking_requests.tenant_id
        and m.user_id = (select auth.uid())
        and m.role in ('operator', 'tenant_admin')
    )
  );

drop policy if exists "customer or staff read photo metadata" on public.booking_photos;
create policy "customer or staff read photo metadata" on public.booking_photos
  for select to authenticated using (
    exists (
      select 1 from public.booking_requests b
      where b.id = booking_photos.booking_id
        and b.tenant_id = booking_photos.tenant_id
        and (
          b.customer_id = (select auth.uid())
          or exists (
            select 1 from public.tenant_memberships m
            where m.tenant_id = b.tenant_id
              and m.user_id = (select auth.uid())
              and m.role in ('operator', 'tenant_admin')
          )
        )
    )
  );

drop policy if exists "customer uploads own equipment photos" on storage.objects;
create policy "customer uploads own equipment photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'equipment-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.extension(name) in ('jpg', 'png', 'webp')
  );

drop policy if exists "customer reads own equipment photos" on storage.objects;
create policy "customer reads own equipment photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'equipment-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
