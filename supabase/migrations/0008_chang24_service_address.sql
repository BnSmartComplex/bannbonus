-- 0008: Chang24-specific precise address intake. Forward-only, no existing row rewrites.
-- The legacy province-based booking API remains for compatibility with existing tenants;
-- the public Chang24 client must use create_chang24_service_request for new work.
alter table public.booking_requests
  add column if not exists service_district text,
  add column if not exists service_address text,
  add column if not exists service_latitude numeric(10,7),
  add column if not exists service_longitude numeric(10,7),
  add column if not exists address_verification_status text not null default 'PENDING_OPERATOR_REVIEW',
  add column if not exists road_distance_meters integer,
  add column if not exists road_distance_verified_at timestamptz,
  add column if not exists road_distance_provider text;

-- Null district/address on historical rows is intentional and requires manual review.
alter table public.booking_requests
  add constraint chang24_service_district_allowed
  check (service_district is null or service_district in ('BANG_YAI','BANG_BUA_THONG')),
  add constraint chang24_service_address_valid
  check (service_address is null or char_length(btrim(service_address)) between 15 and 600),
  add constraint chang24_coordinates_paired check (
    (service_latitude is null and service_longitude is null)
    or (service_latitude is not null and service_longitude is not null and service_latitude between 5 and 21 and service_longitude between 97 and 106)
  ),
  add constraint chang24_address_status_allowed
  check (address_verification_status in ('PENDING_OPERATOR_REVIEW','VERIFIED','REJECTED')),
  add constraint chang24_route_verified_together
  check (
    (road_distance_meters is null and road_distance_verified_at is null and road_distance_provider is null)
    or (road_distance_meters >= 0 and road_distance_verified_at is not null and nullif(btrim(road_distance_provider),'') is not null)
  );

comment on column public.booking_requests.service_address is
  'Customer confirmed text address, PRIVATE. This is not a geocoded pin or a verified driving route.';
comment on column public.booking_requests.road_distance_meters is
  'Only a verified road-route snapshot from the assigned technician dispatch base; never user-entered straight-line distance.';

create or replace function public.create_chang24_service_request(
  p_category text,
  p_fault_description text,
  p_brand text,
  p_model_number text,
  p_district text,
  p_service_address text,
  p_latitude numeric,
  p_longitude numeric,
  p_contact_name text,
  p_contact_phone text,
  p_photo_paths text[],
  p_consent boolean,
  p_idempotency_key uuid,
  p_mode text,
  p_desired_start timestamptz default null,
  p_desired_end timestamptz default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_booking uuid;
  v_existing public.booking_requests%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_district is null or p_district not in ('BANG_YAI','BANG_BUA_THONG') then
    raise exception 'SERVICE_AREA_NOT_SUPPORTED';
  end if;
  if p_service_address is null or char_length(btrim(p_service_address)) not between 15 and 600 then
    raise exception 'SERVICE_ADDRESS_REQUIRED';
  end if;
  if not ((p_latitude is null and p_longitude is null) or
    (p_latitude is not null and p_longitude is not null
      and p_latitude between 5 and 21 and p_longitude between 97 and 106)) then
    raise exception 'INVALID_CUSTOMER_COORDINATES';
  end if;
  -- Exact retry is idempotent only for identical destination/mode information.
  -- On retries from the legacy interface, missing destination must fail closed.
  select * into v_existing from public.booking_requests
    where customer_id=v_actor and idempotency_key=p_idempotency_key for update;
  if found then
    if v_existing.service_district is distinct from p_district
      or v_existing.service_address is distinct from btrim(p_service_address)
      or v_existing.service_latitude is distinct from p_latitude
      or v_existing.service_longitude is distinct from p_longitude
      or v_existing.request_mode is distinct from p_mode
    then raise exception 'REQUEST_RETRY_DATA_MISMATCH'; end if;
    return v_existing.id;
  end if;

  -- Area stays NONTHABURI for backwards-compatible skill/dispatch RPC contracts.
  -- A district label alone does NOT prove technician coverage or routing eligibility.
  v_booking := public.create_service_request(
    p_category,p_fault_description,p_brand,p_model_number,
    'NONTHABURI',p_contact_name,p_contact_phone,p_photo_paths,p_consent,
    p_idempotency_key,p_mode,p_desired_start,p_desired_end
  );
  update public.booking_requests
  set service_district=p_district,
      service_address=btrim(p_service_address),
      service_latitude=p_latitude,
      service_longitude=p_longitude,
      address_verification_status='PENDING_OPERATOR_REVIEW'
  where id=v_booking and customer_id=v_actor
    and service_district is null and service_address is null;
  if not found then
    raise exception 'SERVICE_ADDRESS_UPDATE_FAILED';
  end if;
  return v_booking;
end;
$$;
revoke all on function public.create_chang24_service_request(
  text,text,text,text,text,text,numeric,numeric,text,text,text[],boolean,uuid,text,timestamptz,timestamptz
) from public,anon,authenticated,service_role;
grant execute on function public.create_chang24_service_request(
  text,text,text,text,text,text,text,text,text[],boolean,uuid,text,timestamptz,timestamptz
) to authenticated;
