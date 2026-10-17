-- 0006: confirmed real-time dispatch and customer-agreed alternative booking.
-- Forward-only. No synthetic availability, customer data, or tenant creation.
alter table public.booking_requests
  add column if not exists request_mode text not null default 'BOOKING'
    check (request_mode in ('IMMEDIATE','BOOKING')),
  add column if not exists intake_flow_version smallint not null default 1
    check (intake_flow_version in (1,2)),
  add column if not exists desired_start timestamptz,
  add column if not exists desired_end timestamptz,
  add column if not exists alternative_start timestamptz,
  add column if not exists alternative_end timestamptz,
  add column if not exists alternative_technician_id uuid references auth.users(id),
  add column if not exists alternative_status text not null default 'NONE'
    check (alternative_status in ('NONE','PENDING_CUSTOMER','CUSTOMER_ACCEPTED','CUSTOMER_REJECTED')),
  add column if not exists alternative_proposed_at timestamptz,
  add column if not exists alternative_responded_at timestamptz;
create index if not exists booking_requests_alternative_status_idx
  on public.booking_requests(tenant_id,alternative_status,created_at desc);

-- Bangkok-local service window. Intake itself is open 24 hours.
create or replace function public.is_immediate_service_open(p_at timestamptz)
returns boolean language sql stable set search_path='' as $$
  select (p_at at time zone 'Asia/Bangkok')::time >= time '10:00'
      or (p_at at time zone 'Asia/Bangkok')::time < time '02:00';
$$;
revoke all on function public.is_immediate_service_open(timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.is_immediate_service_open(timestamptz) to anon,authenticated;

-- Anonymous-safe aggregate: no technician identities, PII, or internal schedule.
-- Fail closed if a unique operating tenant has not been provisioned.
create or replace function public.public_dispatch_overview(p_area text,p_skill text)
returns jsonb language plpgsql security definer stable set search_path='' as $$
declare
  v_tenant uuid;
  v_count integer := 0;
  v_open boolean := public.is_immediate_service_open(now());
begin
  if p_area not in ('BANGKOK','NONTHABURI')
    or p_skill not in ('OTHER','AIR_CONDITIONER','REFRIGERATOR','WASHING_MACHINE','ELECTRICAL','PLUMBING','ELECTRONICS')
  then return jsonb_build_object('status','UNKNOWN','service_open',v_open,'available_technicians',0); end if;
  if (select count(*) from public.tenants) <> 1 then
    return jsonb_build_object('status','UNKNOWN','service_open',v_open,'available_technicians',0);
  end if;
  select id into v_tenant from public.tenants limit 1;
  if not v_open then
    return jsonb_build_object('status','CLOSED','service_open',false,'available_technicians',0);
  end if;
  select count(distinct p.technician_id) into v_count
  from public.technician_presence p
  join public.tenant_memberships m on m.tenant_id=p.tenant_id
    and m.user_id=p.technician_id and m.role='technician'
  where p.tenant_id=v_tenant
    and p.presence_status='ONLINE'
    and p.last_seen_at >= now()-interval '5 minutes'
    and exists (
      select 1 from public.technician_capabilities c
      where c.tenant_id=p.tenant_id and c.technician_id=p.technician_id
        and c.service_area=p_area and c.skill=p_skill
    )
    and not exists (
      select 1 from public.technician_visits v
      where v.technician_id=p.technician_id and v.checked_out_at is null
    )
    and not exists (
      select 1 from public.booking_appointments a
      where a.technician_id=p.technician_id and a.status<>'CANCELLED'
        and (
          (a.status='IN_PROGRESS' and a.status<>'COMPLETED')
          or tstzrange(a.scheduled_start,a.scheduled_end,'[)')
            && tstzrange(now(),now()+interval '90 minutes','[)')
        )
    );
  return jsonb_build_object('status',case when v_count>0 then 'AVAILABLE' else 'BUSY' end,
    'service_open',true,'available_technicians',v_count);
end; $$;
revoke all on function public.public_dispatch_overview(text,text) from public,anon,authenticated,service_role;
grant execute on function public.public_dispatch_overview(text,text) to anon,authenticated;

create or replace function public.create_service_request(
  p_category text,p_fault_description text,p_brand text,p_model_number text,
  p_area text,p_contact_name text,p_contact_phone text,p_photo_paths text[],
  p_consent boolean,p_idempotency_key uuid,p_mode text,
  p_desired_start timestamptz default null,p_desired_end timestamptz default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=auth.uid();
  v_booking uuid;
  v_public jsonb;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select id into v_booking from public.booking_requests
    where customer_id=v_actor and idempotency_key=p_idempotency_key;
  if found then return v_booking; end if;
  if p_mode not in ('IMMEDIATE','BOOKING') or p_mode is null then
    raise exception 'INVALID_REQUEST_MODE';
  end if;
  if p_mode='IMMEDIATE' then
    if not public.is_immediate_service_open(now()) then
      raise exception 'OUTSIDE_IMMEDIATE_SERVICE_HOURS';
    end if;
    v_public:=public.public_dispatch_overview(p_area,p_category);
    if (v_public->>'status') <> 'AVAILABLE' then
      raise exception 'NO_TECHNICIAN_AVAILABLE_SELECT_BOOKING';
    end if;
    if p_desired_start is not null or p_desired_end is not null then
      raise exception 'INVALID_IMMEDIATE_TIME_RANGE';
    end if;
  else
    if p_desired_start is null or p_desired_end is null
      or not isfinite(p_desired_start) or not isfinite(p_desired_end)
      or p_desired_start<=now() or p_desired_end<=p_desired_start
      or p_desired_end>p_desired_start+interval '1 day'
      or not public.is_immediate_service_open(p_desired_start)
    then raise exception 'INVALID_BOOKING_TIME_RANGE'; end if;
  end if;
  v_booking:=public.create_booking_request(p_category,p_fault_description,p_brand,p_model_number,
    p_area,p_contact_name,p_contact_phone,p_photo_paths,p_consent,p_idempotency_key);
  update public.booking_requests set request_mode=p_mode,intake_flow_version=2,
    desired_start=p_desired_start,desired_end=p_desired_end where id=v_booking and customer_id=v_actor;
  insert into public.audit_logs(tenant_id,actor_id,action,entity_id)
    select tenant_id,v_actor,'SERVICE_REQUEST_'||p_mode,v_booking
    from public.booking_requests where id=v_booking;
  return v_booking;
end; $$;
revoke all on function public.create_service_request(text,text,text,text,text,text,text,text[],boolean,uuid,text,timestamptz,timestamptz)
from public,anon,authenticated,service_role;
grant execute on function public.create_service_request(text,text,text,text,text,text,text,text[],boolean,uuid,text,timestamptz,timestamptz) to authenticated;

create or replace function public.propose_booking_alternative(
  p_booking_id uuid,p_technician_id uuid,p_start timestamptz,p_end timestamptz
) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_booking public.booking_requests%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_booking from public.booking_requests where id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if not exists(select 1 from public.tenant_memberships m where m.tenant_id=v_booking.tenant_id
    and m.user_id=v_actor and m.role in ('operator','tenant_admin'))
  then raise exception 'OPERATOR_FORBIDDEN'; end if;
  if v_booking.status<>'PENDING_TEAM_REVIEW' or v_booking.request_mode<>'BOOKING' then
    raise exception 'BOOKING_NOT_RESCHEDULABLE';
  end if;
  if not exists(select 1 from public.tenant_memberships m where m.tenant_id=v_booking.tenant_id
    and m.user_id=p_technician_id and m.role='technician')
  then raise exception 'TECHNICIAN_NOT_IN_TENANT'; end if;
  if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end)
    or p_start<=now() or p_end<=p_start or p_end>p_start+interval '1 day'
    or not public.is_immediate_service_open(p_start)
  then raise exception 'INVALID_TIME_RANGE'; end if;
  if not exists(select 1 from public.technician_capabilities c
    where c.tenant_id=v_booking.tenant_id and c.technician_id=p_technician_id
      and c.service_area=v_booking.area and c.skill=v_booking.category)
  then raise exception 'TECHNICIAN_CAPABILITY_MISMATCH'; end if;
  if exists(select 1 from public.technician_visits v
    where v.technician_id=p_technician_id and v.checked_out_at is null)
    or exists(select 1 from public.booking_appointments a
    where a.technician_id=p_technician_id and a.status<>'CANCELLED'
      and tstzrange(a.scheduled_start,a.scheduled_end,'[)') && tstzrange(p_start,p_end,'[)'))
  then raise exception 'TECHNICIAN_NOT_AVAILABLE_FOR_PROPOSAL'; end if;
  update public.booking_requests set alternative_start=p_start,alternative_end=p_end,
    alternative_technician_id=p_technician_id,alternative_status='PENDING_CUSTOMER',
    alternative_proposed_at=now(),alternative_responded_at=null
  where id=p_booking_id;
  insert into public.audit_logs(tenant_id,actor_id,action,entity_id)
    values (v_booking.tenant_id,v_actor,'BOOKING_ALTERNATIVE_PROPOSED',p_booking_id);
end; $$;
revoke all on function public.propose_booking_alternative(uuid,uuid,timestamptz,timestamptz)
from public,anon,authenticated,service_role;
grant execute on function public.propose_booking_alternative(uuid,uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.respond_booking_alternative(p_booking_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_booking public.booking_requests%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_booking from public.booking_requests where id=p_booking_id for update;
  if not found or v_booking.customer_id<>v_actor then raise exception 'CUSTOMER_FORBIDDEN'; end if;
  if v_booking.status<>'PENDING_TEAM_REVIEW' or v_booking.alternative_status<>'PENDING_CUSTOMER'
    or p_accept is null then raise exception 'ALTERNATIVE_NOT_PENDING'; end if;
  update public.booking_requests set alternative_status=
    case when p_accept then 'CUSTOMER_ACCEPTED' else 'CUSTOMER_REJECTED' end,
    alternative_responded_at=now() where id=p_booking_id;
  insert into public.audit_logs(tenant_id,actor_id,action,entity_id)
    values (v_booking.tenant_id,v_actor,case when p_accept then 'BOOKING_ALTERNATIVE_ACCEPTED'
      else 'BOOKING_ALTERNATIVE_REJECTED' end,p_booking_id);
end; $$;
revoke all on function public.respond_booking_alternative(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.respond_booking_alternative(uuid,boolean) to authenticated;

-- Server authoritative guard applies even to direct RPC use, not just button state.
create or replace function public.guard_service_assignment_agreement()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_booking public.booking_requests%rowtype;v_check record;
begin
  select * into v_booking from public.booking_requests where id=new.booking_id;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.intake_flow_version<>2 then return new; end if;
  if v_booking.request_mode='BOOKING' then
    if v_booking.alternative_status<>'NONE' then
      if v_booking.alternative_status<>'CUSTOMER_ACCEPTED'
        or new.technician_id is distinct from v_booking.alternative_technician_id
        or new.scheduled_start is distinct from v_booking.alternative_start
        or new.scheduled_end is distinct from v_booking.alternative_end
      then raise exception 'CUSTOMER_ALTERNATIVE_APPROVAL_REQUIRED'; end if;
    elsif new.scheduled_start is distinct from v_booking.desired_start
      or new.scheduled_end is distinct from v_booking.desired_end
    then raise exception 'CUSTOMER_REQUESTED_TIME_MISMATCH'; end if;
    if not exists(select 1 from public.technician_capabilities c
      where c.tenant_id=v_booking.tenant_id and c.technician_id=new.technician_id
        and c.service_area=v_booking.area and c.skill=v_booking.category)
    then raise exception 'TECHNICIAN_CAPABILITY_MISMATCH'; end if;
    if exists(select 1 from public.technician_visits v
      where v.technician_id=new.technician_id and v.checked_out_at is null)
    then raise exception 'TECHNICIAN_HAS_ACTIVE_VISIT'; end if;
  else
    if not public.is_immediate_service_open(now())
       or new.scheduled_start>now()+interval '2 hours'
       or new.scheduled_start<=now() then raise exception 'IMMEDIATE_DISPATCH_WINDOW_CLOSED'; end if;
    select * into v_check from public.get_technician_dispatch_eligibility(
      v_booking.tenant_id,new.technician_id,v_booking.area,v_booking.category,
      new.scheduled_start,new.scheduled_end);
    if not coalesce(v_check.is_available,false) then
      raise exception 'DISPATCH_INELIGIBLE'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists guard_service_assignment_agreement on public.booking_appointments;
create trigger guard_service_assignment_agreement before insert on public.booking_appointments
  for each row execute function public.guard_service_assignment_agreement();
revoke all on function public.guard_service_assignment_agreement() from public,anon,authenticated,service_role;
