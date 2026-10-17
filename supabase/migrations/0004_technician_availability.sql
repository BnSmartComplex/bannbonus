-- C1: backend-authoritative technician presence and dispatch eligibility.
-- Apply only to an isolated, approved Supabase test project.
create table if not exists public.technician_presence (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  technician_id uuid not null references auth.users(id) on delete cascade,
  presence_status text not null default 'OFFLINE'
    check (presence_status in ('ONLINE', 'OFFLINE')),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, technician_id),
  foreign key (tenant_id, technician_id)
    references public.tenant_memberships(tenant_id, user_id)
);

create table if not exists public.technician_capabilities (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  technician_id uuid not null references auth.users(id) on delete cascade,
  service_area text not null check (service_area in ('BANGKOK', 'NONTHABURI')),
  skill text not null check (char_length(trim(skill)) between 1 and 120),
  primary key (tenant_id, technician_id, service_area, skill),
  foreign key (tenant_id, technician_id)
    references public.tenant_memberships(tenant_id, user_id)
);

create table if not exists public.technician_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null unique references public.booking_appointments(id) on delete cascade,
  technician_id uuid not null references auth.users(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  check (checked_out_at is null or checked_out_at >= checked_in_at),
  foreign key (tenant_id, technician_id)
    references public.tenant_memberships(tenant_id, user_id)
);

create unique index if not exists technician_one_active_visit_idx
  on public.technician_visits(technician_id)
  where checked_out_at is null;
create index if not exists technician_presence_freshness_idx
  on public.technician_presence(tenant_id, presence_status, last_seen_at);
create index if not exists technician_capabilities_lookup_idx
  on public.technician_capabilities(tenant_id, service_area, skill, technician_id);
create index if not exists technician_visits_tenant_idx
  on public.technician_visits(tenant_id, technician_id, checked_out_at);

alter table public.technician_presence enable row level security;
alter table public.technician_capabilities enable row level security;
alter table public.technician_visits enable row level security;

create policy "presence is visible to tenant staff and self"
  on public.technician_presence for select to authenticated using (
    technician_id = (select auth.uid())
    or exists (
      select 1 from public.tenant_memberships m
      where m.tenant_id = technician_presence.tenant_id
        and m.user_id = (select auth.uid())
        and m.role in ('operator', 'tenant_admin')
    )
  );

create policy "capabilities are visible to tenant staff and self"
  on public.technician_capabilities for select to authenticated using (
    technician_id = (select auth.uid())
    or exists (
      select 1 from public.tenant_memberships m
      where m.tenant_id = technician_capabilities.tenant_id
        and m.user_id = (select auth.uid())
        and m.role in ('operator', 'tenant_admin')
    )
  );

create policy "visits are visible to authorized tenant users"
  on public.technician_visits for select to authenticated using (
    technician_id = (select auth.uid())
    or exists (
      select 1 from public.tenant_memberships m
      where m.tenant_id = technician_visits.tenant_id
        and m.user_id = (select auth.uid())
        and m.role in ('operator', 'tenant_admin')
    )
  );

revoke all on table
  public.technician_presence,
  public.technician_capabilities,
  public.technician_visits
from public, anon, authenticated, service_role;
grant select on table
  public.technician_presence,
  public.technician_capabilities,
  public.technician_visits
to authenticated;

create or replace function public.set_technician_presence(
  p_tenant_id uuid,
  p_presence_status text
)
returns public.technician_presence
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_row public.technician_presence;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_tenant_id is null or p_presence_status not in ('ONLINE', 'OFFLINE') then
    raise exception 'INVALID_PRESENCE_STATUS';
  end if;
  if not exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = p_tenant_id and m.user_id = v_actor and m.role = 'technician'
  ) then
    raise exception 'TECHNICIAN_FORBIDDEN';
  end if;

  insert into public.technician_presence
    (tenant_id, technician_id, presence_status, last_seen_at, updated_at)
  values (p_tenant_id, v_actor, p_presence_status, now(), now())
  on conflict (tenant_id, technician_id) do update
    set presence_status = excluded.presence_status,
        last_seen_at = now(),
        updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.set_technician_presence(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_technician_presence(uuid, text) to authenticated;

create or replace function public.get_technician_dispatch_eligibility(
  p_tenant_id uuid,
  p_technician_id uuid,
  p_service_area text,
  p_skill text,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz
)
returns table (
  technician_id uuid,
  presence_status text,
  presence_is_fresh boolean,
  has_active_visit boolean,
  has_active_assignment boolean,
  has_conflicting_booking boolean,
  skill_match boolean,
  area_match boolean,
  is_available boolean,
  reasons text[]
)
language plpgsql security definer stable set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_presence public.technician_presence;
  v_fresh boolean;
  v_active_visit boolean;
  v_active_assignment boolean;
  v_conflict boolean;
  v_skill boolean;
  v_area boolean;
  v_online boolean;
  v_available boolean;
  v_reasons text[];
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_tenant_id is null or p_technician_id is null
     or p_scheduled_start is null or p_scheduled_end is null
     or not isfinite(p_scheduled_start) or not isfinite(p_scheduled_end)
     or p_scheduled_end <= p_scheduled_start
     or p_service_area not in ('BANGKOK', 'NONTHABURI')
     or char_length(trim(coalesce(p_skill, ''))) = 0
  then
    raise exception 'INVALID_ELIGIBILITY_REQUEST';
  end if;
  if not exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = v_actor
      and (m.role in ('operator', 'tenant_admin')
        or (m.role = 'technician' and m.user_id = p_technician_id))
  ) then
    raise exception 'ELIGIBILITY_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = p_technician_id
      and m.role = 'technician'
  ) then
    raise exception 'TECHNICIAN_NOT_IN_TENANT';
  end if;

  select * into v_presence
  from public.technician_presence p
  where p.tenant_id = p_tenant_id and p.technician_id = p_technician_id;
  v_online := coalesce(v_presence.presence_status = 'ONLINE', false);
  v_fresh := coalesce(v_presence.last_seen_at >= now() - interval '5 minutes', false);
  v_active_visit := exists (
    select 1 from public.technician_visits v
    where v.tenant_id = p_tenant_id and v.technician_id = p_technician_id
      and v.checked_out_at is null
  );
  v_active_assignment := exists (
    select 1 from public.booking_appointments a
    where a.tenant_id = p_tenant_id and a.technician_id = p_technician_id
      and a.status in ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
      and tstzrange(a.scheduled_start, a.scheduled_end, '[)')
          && tstzrange(p_scheduled_start, p_scheduled_end, '[)')
  );
  v_conflict := exists (
    select 1 from public.booking_appointments a
    where a.technician_id = p_technician_id
      and a.status <> 'CANCELLED'
      and tstzrange(a.scheduled_start, a.scheduled_end, '[)')
          && tstzrange(p_scheduled_start, p_scheduled_end, '[)')
  );
  v_area := exists (
    select 1 from public.technician_capabilities c
    where c.tenant_id = p_tenant_id and c.technician_id = p_technician_id
      and c.service_area = p_service_area
  );
  v_skill := exists (
    select 1 from public.technician_capabilities c
    where c.tenant_id = p_tenant_id and c.technician_id = p_technician_id
      and c.skill = trim(p_skill)
  );
  v_available := v_online and v_fresh and not v_active_visit
    and not v_active_assignment and not v_conflict and v_skill and v_area;
  v_reasons := array_remove(array[
    case when not v_online then 'OFFLINE' end,
    case when v_online and not v_fresh then 'PRESENCE_STALE' end,
    case when v_active_visit then 'ACTIVE_VISIT' end,
    case when v_active_assignment then 'ACTIVE_ASSIGNMENT' end,
    case when v_conflict then 'SCHEDULE_CONFLICT' end,
    case when not v_skill then 'SKILL_MISMATCH' end,
    case when not v_area then 'AREA_MISMATCH' end
  ], null);

  return query select p_technician_id, coalesce(v_presence.presence_status, 'OFFLINE'),
    v_fresh, v_active_visit, v_active_assignment, v_conflict, v_skill, v_area,
    v_available, coalesce(v_reasons, array[]::text[]);
end;
$$;

revoke all on function public.get_technician_dispatch_eligibility(
  uuid, uuid, text, text, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.get_technician_dispatch_eligibility(
  uuid, uuid, text, text, timestamptz, timestamptz
) to authenticated;

create or replace function public.dispatch_and_assign_technician(
  p_booking_id uuid,
  p_technician_id uuid,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.booking_requests%rowtype;
  v_check record;
  v_appointment uuid;
  v_estimate integer;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_booking from public.booking_requests where id = p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.tenant_memberships m
    where m.tenant_id = v_booking.tenant_id and m.user_id = v_actor
      and m.role in ('operator', 'tenant_admin')
  ) then raise exception 'OPERATOR_FORBIDDEN'; end if;
  if v_booking.status <> 'PENDING_TEAM_REVIEW' then raise exception 'BOOKING_NOT_PENDING'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_technician_id::text, 0));
  select * into v_check from public.get_technician_dispatch_eligibility(
    v_booking.tenant_id, p_technician_id, v_booking.area, v_booking.category,
    p_scheduled_start, p_scheduled_end
  );
  if not v_check.is_available then
    raise exception 'DISPATCH_INELIGIBLE:%', array_to_string(v_check.reasons, ',');
  end if;
  v_estimate := public.booking_price_baht(p_scheduled_start);
  update public.booking_requests set status = 'CONFIRMED'
  where id = p_booking_id and status = 'PENDING_TEAM_REVIEW';
  insert into public.booking_appointments (
    booking_id, tenant_id, technician_id, scheduled_start, scheduled_end,
    estimated_dispatch_fee_baht, actual_dispatch_fee_baht, payment_status, created_by
  ) values (
    p_booking_id, v_booking.tenant_id, p_technician_id, p_scheduled_start, p_scheduled_end,
    v_estimate, null, 'NOT_CHARGED', v_actor
  ) returning id into v_appointment;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_id)
  values (v_booking.tenant_id, v_actor, 'DISPATCH_APPROVED_AND_ASSIGNED', p_booking_id);
  return v_appointment;
exception when exclusion_violation then
  raise exception 'TECHNICIAN_TIME_CONFLICT';
end;
$$;

revoke all on function public.dispatch_and_assign_technician(uuid, uuid, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.dispatch_and_assign_technician(uuid, uuid, timestamptz, timestamptz)
  to authenticated;

create or replace function public.technician_check_in(p_appointment_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_status text;
  v_visit uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  select tenant_id, status into v_tenant, v_status
  from public.booking_appointments
  where id = p_appointment_id and technician_id = v_actor for update;
  if not found then raise exception 'TECHNICIAN_FORBIDDEN'; end if;
  if v_status <> 'ACCEPTED' then raise exception 'CHECK_IN_REQUIRES_ACCEPTED'; end if;
  if exists (select 1 from public.technician_visits where technician_id = v_actor and checked_out_at is null)
    then raise exception 'ACTIVE_VISIT_EXISTS'; end if;
  insert into public.technician_visits (tenant_id, appointment_id, technician_id)
  values (v_tenant, p_appointment_id, v_actor) returning id into v_visit;
  update public.booking_appointments set status = 'IN_PROGRESS', updated_at = now()
  where id = p_appointment_id;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_id)
  values (v_tenant, v_actor, 'TECHNICIAN_CHECKED_IN', (select booking_id from public.booking_appointments where id = p_appointment_id));
  return v_visit;
end;
$$;

revoke all on function public.technician_check_in(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.technician_check_in(uuid) to authenticated;

create or replace function public.technician_check_out(p_appointment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_booking uuid;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  select tenant_id, booking_id into v_tenant, v_booking
  from public.booking_appointments
  where id = p_appointment_id and technician_id = v_actor and status = 'IN_PROGRESS'
  for update;
  if not found then raise exception 'CHECK_OUT_FORBIDDEN'; end if;
  update public.technician_visits set checked_out_at = now()
  where appointment_id = p_appointment_id and technician_id = v_actor and checked_out_at is null;
  if not found then raise exception 'ACTIVE_VISIT_NOT_FOUND'; end if;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_id)
  values (v_tenant, v_actor, 'TECHNICIAN_CHECKED_OUT', v_booking);
end;
$$;

revoke all on function public.technician_check_out(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.technician_check_out(uuid) to authenticated;
