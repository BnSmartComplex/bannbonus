-- Atomic operator approval, tenant-scoped technician directory and technician job state machine.
-- Apply only to the isolated, approved Supabase test project.
create extension if not exists btree_gist;

create table if not exists public.booking_appointments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.booking_requests(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  technician_id uuid not null references auth.users(id),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  -- This is a non-binding estimate from the scheduled start. It is never a charge.
  estimated_dispatch_fee_baht integer not null check (estimated_dispatch_fee_baht in (299, 499)),
  actual_dispatch_fee_baht integer null check (actual_dispatch_fee_baht is null),
  payment_status text not null default 'NOT_CHARGED'
    check (payment_status = 'NOT_CHARGED'),
  status text not null default 'ASSIGNED'
    check (status in ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (isfinite(scheduled_start) and isfinite(scheduled_end) and scheduled_end > scheduled_start),
  constraint booking_appointments_no_technician_overlap exclude using gist (
    technician_id with =,
    tstzrange(scheduled_start, scheduled_end, '[)') with &&
  ) where (status <> 'CANCELLED'),
  foreign key (booking_id, tenant_id) references public.booking_requests(id, tenant_id)
);

create index if not exists booking_appointments_technician_time_idx
  on public.booking_appointments(technician_id, scheduled_start, scheduled_end);
create index if not exists booking_appointments_tenant_idx
  on public.booking_appointments(tenant_id, scheduled_start);

alter table public.booking_appointments enable row level security;
drop policy if exists "appointment members can read their tenant" on public.booking_appointments;
create policy "appointment members can read their tenant"
on public.booking_appointments for select to authenticated using (
  exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = booking_appointments.tenant_id
      and m.user_id = auth.uid()
      and (m.role in ('operator', 'tenant_admin')
        or (m.role = 'technician' and m.user_id = booking_appointments.technician_id))
  )
  or exists (
    select 1 from public.booking_requests b
    where b.id = booking_appointments.booking_id and b.tenant_id = booking_appointments.tenant_id
      and b.customer_id = auth.uid()
  )
);

revoke all on public.booking_appointments from public, anon, authenticated, service_role;
grant select on public.booking_appointments to authenticated;

create or replace function public.booking_price_baht(p_scheduled_start timestamptz)
returns integer language plpgsql immutable set search_path = '' as $$
declare local_time time := (p_scheduled_start at time zone 'Asia/Bangkok')::time;
begin
  if local_time >= time '10:00' and local_time < time '21:00' then return 299;
  elsif local_time >= time '21:00' or local_time < time '02:00' then return 499;
  end if;
  raise exception 'OUTSIDE_SERVICE_PRICE_WINDOW';
end;
$$;

revoke all on function public.booking_price_baht(timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.booking_price_baht(timestamptz) to authenticated;

-- Returns technicians only after the database verifies that the caller is staff
-- in the requested tenant. It intentionally bypasses self-only membership RLS
-- inside a tightly scoped SECURITY DEFINER function.
create or replace function public.list_tenant_technicians(p_tenant_id uuid)
returns table(user_id uuid)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_tenant_id is null
    or not exists (
      select 1 from public.tenant_memberships m
      where m.tenant_id = p_tenant_id
        and m.user_id = v_actor
        and m.role in ('operator', 'tenant_admin')
    )
  then
    raise exception 'STAFF_DIRECTORY_FORBIDDEN';
  end if;

  return query
    select m.user_id
    from public.tenant_memberships m
    where m.tenant_id = p_tenant_id
      and m.role = 'technician'
    order by m.user_id;
end;
$$;

revoke all on function public.list_tenant_technicians(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.list_tenant_technicians(uuid) to authenticated;

create or replace function public.approve_booking_and_assign_technician(
  p_booking_id uuid, p_technician_id uuid, p_scheduled_start timestamptz, p_scheduled_end timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.booking_requests%rowtype;
  v_appointment uuid;
  v_existing public.booking_appointments%rowtype;
  v_estimate integer;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_booking
  from public.booking_requests
  where id = p_booking_id
  for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if not exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = v_booking.tenant_id
      and m.user_id = v_actor
      and m.role in ('operator', 'tenant_admin')
  ) then
    raise exception 'OPERATOR_FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = v_booking.tenant_id
      and m.user_id = p_technician_id
      and m.role = 'technician'
  ) then
    raise exception 'TECHNICIAN_NOT_IN_TENANT';
  end if;

  if p_scheduled_start is null or p_scheduled_end is null
    or not isfinite(p_scheduled_start) or not isfinite(p_scheduled_end)
    or p_scheduled_end <= p_scheduled_start
  then
    raise exception 'INVALID_TIME_RANGE';
  end if;

  -- The booking row lock serializes exact retries before overlap checks.
  select * into v_existing
  from public.booking_appointments
  where booking_id = p_booking_id;
  if found then
    if v_booking.status <> 'CONFIRMED' then raise exception 'BOOKING_NOT_PENDING'; end if;
    if v_existing.technician_id is distinct from p_technician_id
      or v_existing.scheduled_start is distinct from p_scheduled_start
      or v_existing.scheduled_end is distinct from p_scheduled_end
    then
      raise exception 'APPROVAL_RETRY_MISMATCH';
    end if;
    return v_existing.id;
  end if;

  if v_booking.status <> 'PENDING_TEAM_REVIEW' then
    raise exception 'BOOKING_NOT_PENDING';
  end if;

  -- A technician is one person even across tenants. The lock plus exclusion
  -- constraint protects concurrent approval attempts.
  perform pg_advisory_xact_lock(hashtextextended(p_technician_id::text, 0));
  if exists (
    select 1 from public.booking_appointments a
    where a.technician_id = p_technician_id
      and a.status <> 'CANCELLED'
      and tstzrange(a.scheduled_start, a.scheduled_end, '[)')
          && tstzrange(p_scheduled_start, p_scheduled_end, '[)')
  ) then
    raise exception 'TECHNICIAN_TIME_CONFLICT';
  end if;

  v_estimate := public.booking_price_baht(p_scheduled_start);
  update public.booking_requests
  set status = 'CONFIRMED'
  where id = p_booking_id and status = 'PENDING_TEAM_REVIEW';

  insert into public.booking_appointments (
    booking_id, tenant_id, technician_id, scheduled_start, scheduled_end,
    estimated_dispatch_fee_baht, actual_dispatch_fee_baht, payment_status, created_by
  )
  values (
    p_booking_id, v_booking.tenant_id, p_technician_id, p_scheduled_start, p_scheduled_end,
    v_estimate, null, 'NOT_CHARGED', v_actor
  )
  returning id into v_appointment;

  insert into public.audit_logs (tenant_id, actor_id, action, entity_id)
  values (v_booking.tenant_id, v_actor, 'BOOKING_APPROVED_AND_ASSIGNED', p_booking_id);
  return v_appointment;
exception when exclusion_violation then
  raise exception 'TECHNICIAN_TIME_CONFLICT';
end;
$$;

revoke all on function public.approve_booking_and_assign_technician(uuid, uuid, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.approve_booking_and_assign_technician(uuid, uuid, timestamptz, timestamptz)
  to authenticated;

create or replace function public.technician_update_appointment_status(
  p_appointment_id uuid,
  p_status text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_booking uuid;
  v_current text;
  v_booking_status text;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_status is null
    or p_status not in ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
  then
    raise exception 'INVALID_APPOINTMENT_STATUS';
  end if;

  select a.tenant_id, a.booking_id, a.status, b.status
  into v_tenant, v_booking, v_current, v_booking_status
  from public.booking_appointments a
  join public.booking_requests b on b.id = a.booking_id
  where a.id = p_appointment_id
    and a.technician_id = v_actor
  for update;

  if not found then raise exception 'TECHNICIAN_FORBIDDEN'; end if;
  if not exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = v_tenant
      and m.user_id = v_actor
      and m.role = 'technician'
  ) then
    raise exception 'TECHNICIAN_FORBIDDEN';
  end if;

  -- Same-state retries are idempotent. Every other state change must follow
  -- the one-way graph and terminal states cannot be reopened.
  if p_status = v_current then return; end if;

  if v_current = 'ASSIGNED' and p_status not in ('ACCEPTED', 'CANCELLED') then
    raise exception 'INVALID_APPOINTMENT_TRANSITION';
  elsif v_current = 'ACCEPTED' and p_status not in ('IN_PROGRESS', 'CANCELLED') then
    raise exception 'INVALID_APPOINTMENT_TRANSITION';
  elsif v_current = 'IN_PROGRESS' and p_status not in ('COMPLETED', 'CANCELLED') then
    raise exception 'INVALID_APPOINTMENT_TRANSITION';
  elsif v_current in ('COMPLETED', 'CANCELLED') then
    raise exception 'INVALID_APPOINTMENT_TRANSITION';
  end if;

  if v_booking_status not in ('CONFIRMED', 'CANCELLED') then
    raise exception 'BOOKING_NOT_ACTIVE';
  end if;

  if p_status = 'CANCELLED' then
    if v_booking_status = 'CONFIRMED' then
      update public.booking_requests
      set status = 'CANCELLED'
      where id = v_booking;
    end if;
  elsif v_booking_status = 'CANCELLED' then
    raise exception 'BOOKING_NOT_ACTIVE';
  end if;

  update public.booking_appointments
  set status = p_status, updated_at = now()
  where id = p_appointment_id;

  insert into public.audit_logs (tenant_id, actor_id, action, entity_id)
  values (v_tenant, v_actor, 'APPOINTMENT_STATUS_' || p_status, v_booking);
end;
$$;

revoke all on function public.technician_update_appointment_status(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.technician_update_appointment_status(uuid, text) to authenticated;
