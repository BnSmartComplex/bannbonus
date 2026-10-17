-- Forward-only hardening of already-applied 0003/0004 functions.
-- Deploy through reviewed database migrations; do not replay earlier DDL.
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

  if p_scheduled_start is null or p_scheduled_end is null
    or not isfinite(p_scheduled_start) or not isfinite(p_scheduled_end)
    or p_scheduled_end <= p_scheduled_start
    or p_scheduled_start <= now()
  then
    raise exception 'INVALID_TIME_RANGE';
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
  v_pair boolean;
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
    where v.technician_id = p_technician_id
      and v.checked_out_at is null
  );
  v_active_assignment := exists (
    select 1 from public.booking_appointments a
    where a.technician_id = p_technician_id
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
  v_pair := exists (
    select 1 from public.technician_capabilities c
    where c.tenant_id = p_tenant_id and c.technician_id = p_technician_id
      and c.service_area = p_service_area and c.skill = trim(p_skill)
  );
  v_available := v_online and v_fresh and not v_active_visit
    and not v_active_assignment and not v_conflict and v_pair;
  v_reasons := array_remove(array[
    case when not v_online then 'OFFLINE' end,
    case when v_online and not v_fresh then 'PRESENCE_STALE' end,
    case when v_active_visit then 'ACTIVE_VISIT' end,
    case when v_active_assignment then 'ACTIVE_ASSIGNMENT' end,
    case when v_conflict then 'SCHEDULE_CONFLICT' end,
    case when not v_skill then 'SKILL_MISMATCH' end,
    case when not v_area then 'AREA_MISMATCH' end,
    case when v_area and v_skill and not v_pair then 'SKILL_AREA_MISMATCH' end
  ], null);

  return query select p_technician_id, coalesce(v_presence.presence_status, 'OFFLINE'),
    v_fresh, v_active_visit, v_active_assignment, v_conflict, v_skill, v_area,
    v_available, coalesce(v_reasons, array[]::text[]);
end;
$$;

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
  v_existing public.booking_appointments%rowtype;
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
  -- Booking lock serializes exact retries before any new availability checks.
  select * into v_existing from public.booking_appointments where booking_id = p_booking_id;
  if found then
    if v_booking.status <> 'CONFIRMED' then raise exception 'BOOKING_NOT_PENDING'; end if;
    if v_existing.technician_id is distinct from p_technician_id
      or v_existing.scheduled_start is distinct from p_scheduled_start
      or v_existing.scheduled_end is distinct from p_scheduled_end
    then raise exception 'DISPATCH_RETRY_MISMATCH'; end if;
    return v_existing.id;
  end if;
  if p_scheduled_start is null or p_scheduled_end is null
    or not isfinite(p_scheduled_start) or not isfinite(p_scheduled_end)
    or p_scheduled_end <= p_scheduled_start or p_scheduled_start <= now()
  then raise exception 'INVALID_TIME_RANGE'; end if;
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
  update public.booking_appointments set status = 'COMPLETED', updated_at = now()
  where id = p_appointment_id and status = 'IN_PROGRESS';
  insert into public.audit_logs (tenant_id, actor_id, action, entity_id)
  values (v_tenant, v_actor, 'TECHNICIAN_CHECKED_OUT', v_booking);
end;
$$;

-- Only the photo owner may delete a still-unattached upload on failed intake.
-- Referenced booking images remain protected.
create policy "customer can remove unattached equipment photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'equipment-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.booking_photos bp
    join public.booking_requests b on b.id = bp.booking_id
    where bp.storage_path = storage.objects.name
      and b.customer_id = (select auth.uid())
  )
);
