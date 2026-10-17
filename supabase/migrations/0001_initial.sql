-- Chang24 initial schema. Apply only to isolated, approved Supabase projects.
-- This starter has no production deployment; do not apply this migration to Production.
create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('customer', 'technician', 'operator', 'tenant_admin')),
  primary key (tenant_id, user_id)
);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  customer_id uuid not null references auth.users(id),
  category text not null check (
    category in (
      'OTHER', 'AIR_CONDITIONER', 'REFRIGERATOR', 'WASHING_MACHINE',
      'ELECTRICAL', 'PLUMBING', 'ELECTRONICS'
    )
  ),
  fault_description text not null check (char_length(trim(fault_description)) between 20 and 4000),
  brand text not null default '',
  model_number text not null default '',
  area text not null check (area in ('BANGKOK', 'NONTHABURI')),
  contact_name text not null,
  contact_phone text not null,
  idempotency_key uuid not null,
  consent_given_at timestamptz not null default now(),
  consent_notice_version text not null default 'chang24-intake-v1',
  status text not null default 'PENDING_TEAM_REVIEW'
    check (status in ('PENDING_TEAM_REVIEW', 'CONFIRMED', 'DECLINED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  constraint booking_requests_id_tenant_unique unique (id, tenant_id),
  constraint booking_requests_customer_idempotency_unique unique (customer_id, idempotency_key)
);

create table if not exists public.booking_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  tenant_id uuid not null references public.tenants(id),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  foreign key (booking_id, tenant_id)
    references public.booking_requests(id, tenant_id) on delete cascade
);

create table if not exists public.research_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  booking_id uuid not null,
  event_type text not null default 'DEVICE_RESEARCH_REQUESTED',
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique (booking_id, event_type),
  foreign key (booking_id, tenant_id)
    references public.booking_requests(id, tenant_id) on delete cascade
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (entity_id, tenant_id)
    references public.booking_requests(id, tenant_id)
);

create index if not exists booking_requests_customer_idx
  on public.booking_requests(customer_id, created_at desc);
create index if not exists booking_requests_tenant_idx
  on public.booking_requests(tenant_id, created_at desc);

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.booking_requests enable row level security;
alter table public.booking_photos enable row level security;
alter table public.research_outbox enable row level security;
alter table public.audit_logs enable row level security;

-- Memberships are provisioned by a trusted admin, never by customer.
create policy "members can view own membership" on public.tenant_memberships
  for select to authenticated using (user_id = auth.uid());

create policy "members can view own tenant" on public.tenants
  for select to authenticated using (
    exists (
      select 1 from public.tenant_memberships m
      where m.tenant_id = id and m.user_id = auth.uid()
    )
  );

create policy "customer or staff read requests" on public.booking_requests
  for select to authenticated using (
    customer_id = auth.uid()
    or exists (
      select 1 from public.tenant_memberships m
      where m.tenant_id = booking_requests.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('operator', 'tenant_admin')
    )
  );

create policy "customer or staff read photo metadata" on public.booking_photos
  for select to authenticated using (
    exists (
      select 1 from public.booking_requests b
      where b.id = booking_photos.booking_id
        and b.tenant_id = booking_photos.tenant_id
        and (
          b.customer_id = auth.uid()
          or exists (
            select 1 from public.tenant_memberships m
            where m.tenant_id = b.tenant_id
              and m.user_id = auth.uid()
              and m.role in ('operator', 'tenant_admin')
          )
        )
    )
  );

-- Supabase Data API access requires both grants and RLS. Revoke broad/default
-- table access, then grant only the SELECT surface protected by the policies above.
revoke all on table
  public.tenants,
  public.tenant_memberships,
  public.booking_requests,
  public.booking_photos,
  public.research_outbox,
  public.audit_logs
from public, anon, authenticated, service_role;

grant usage on schema public to authenticated;
grant select on table
  public.tenants,
  public.tenant_memberships,
  public.booking_requests,
  public.booking_photos
to authenticated;

-- Create without changing an existing bucket. Fail closed if an existing bucket
-- with this name does not match the expected private starter configuration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'equipment-photos',
  'equipment-photos',
  false,
  5000000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'equipment-photos'
      and name = 'equipment-photos'
      and public = false
      and file_size_limit = 5000000
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
  ) then
    raise exception 'EQUIPMENT_PHOTO_BUCKET_CONFIGURATION_MISMATCH';
  end if;
end
$$;

create policy "customer uploads own equipment photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'equipment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and storage.extension(name) in ('jpg', 'png', 'webp')
  );

create policy "customer reads own equipment photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'equipment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SECURITY DEFINER is limited to authenticated callers. It uses an empty
-- search_path, fully-qualified tables, auth.uid(), backend validation and audit.
create or replace function public.create_booking_request(
  p_category text,
  p_fault_description text,
  p_brand text,
  p_model_number text,
  p_area text,
  p_contact_name text,
  p_contact_phone text,
  p_photo_paths text[],
  p_consent boolean,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_booking uuid;
  v_path text;
  v_customer_membership_count bigint;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  -- Return the original result on retry, including after a lost RPC response.
  select b.id into v_booking
  from public.booking_requests b
  where b.customer_id = v_user and b.idempotency_key = p_idempotency_key;
  if v_booking is not null then
    return v_booking;
  end if;

  if not coalesce(p_consent, false) then
    raise exception 'CONSENT_REQUIRED';
  end if;
  if p_category is null or p_category not in (
    'OTHER', 'AIR_CONDITIONER', 'REFRIGERATOR', 'WASHING_MACHINE',
    'ELECTRICAL', 'PLUMBING', 'ELECTRONICS'
  )
    or p_fault_description is null
    or char_length(trim(p_fault_description)) not between 20 and 4000
    or char_length(coalesce(p_brand, '')) > 120
    or char_length(coalesce(p_model_number, '')) > 120
    or p_area is null or p_area not in ('BANGKOK', 'NONTHABURI')
    or char_length(trim(coalesce(p_contact_name, ''))) not between 2 and 120
    or coalesce(p_contact_phone, '') !~ '^0[0-9]{8,9}$'
  then
    raise exception 'VALIDATION_ERROR';
  end if;

  if coalesce(array_length(p_photo_paths, 1), 0) > 4 then
    raise exception 'TOO_MANY_PHOTOS';
  end if;
  if (trim(coalesce(p_brand, '')) = '' or trim(coalesce(p_model_number, '')) = '')
    and coalesce(array_length(p_photo_paths, 1), 0) = 0
  then
    raise exception 'PHOTO_OR_BRAND_MODEL_REQUIRED';
  end if;

  -- Never choose an arbitrary tenant if the account has ambiguous membership.
  select
    count(*),
    (array_agg(m.tenant_id order by m.tenant_id))[1]
  into v_customer_membership_count, v_tenant
  from public.tenant_memberships m
  where m.user_id = v_user and m.role = 'customer';
  if v_customer_membership_count <> 1 then
    raise exception 'SINGLE_CUSTOMER_MEMBERSHIP_REQUIRED';
  end if;

  foreach v_path in array coalesce(p_photo_paths, array[]::text[]) loop
    if v_path is null
      or v_path not like v_user::text || '/%'
      or not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'equipment-photos'
          and o.name = v_path
          and o.owner_id = v_user::text
      )
    then
      raise exception 'INVALID_PHOTO';
    end if;
    if exists (select 1 from public.booking_photos bp where bp.storage_path = v_path) then
      raise exception 'PHOTO_ALREADY_USED';
    end if;
  end loop;

  -- The unique constraint is the concurrency guard for duplicate retries.
  begin
    insert into public.booking_requests (
      tenant_id,
      customer_id,
      category,
      fault_description,
      brand,
      model_number,
      area,
      contact_name,
      contact_phone,
      idempotency_key
    )
    values (
      v_tenant,
      v_user,
      p_category,
      trim(p_fault_description),
      trim(coalesce(p_brand, '')),
      trim(coalesce(p_model_number, '')),
      p_area,
      trim(p_contact_name),
      p_contact_phone,
      p_idempotency_key
    )
    returning id into v_booking;
  exception when unique_violation then
    select b.id into v_booking
    from public.booking_requests b
    where b.customer_id = v_user and b.idempotency_key = p_idempotency_key;
    if v_booking is not null then
      return v_booking;
    end if;
    raise;
  end;

  foreach v_path in array coalesce(p_photo_paths, array[]::text[]) loop
    insert into public.booking_photos (booking_id, tenant_id, storage_path)
    values (v_booking, v_tenant, v_path);
  end loop;

  insert into public.research_outbox (tenant_id, booking_id)
  values (v_tenant, v_booking);
  insert into public.audit_logs (tenant_id, actor_id, action, entity_id)
  values (v_tenant, v_user, 'BOOKING_REQUEST_CREATED', v_booking);

  return v_booking;
end;
$$;

revoke all on function public.create_booking_request(
  text, text, text, text, text, text, text, text[], boolean, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.create_booking_request(
  text, text, text, text, text, text, text, text[], boolean, uuid
) to authenticated;

-- Human booking confirmation is intentionally NOT exposed until atomic scheduling,
-- overlap checks, role authorization, conflict handling and full audit are implemented.
