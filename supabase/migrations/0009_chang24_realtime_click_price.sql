-- 0009: Owner-confirmed realtime tariff uses database time at customer FINAL call-click.
-- Applies to Chang24 intake RPC only; legacy BannBonus requests remain untouched.
alter table public.booking_requests
  add column if not exists realtime_clicked_at timestamptz,
  add column if not exists realtime_base_fee_baht integer;

alter table public.booking_requests
  add constraint chang24_click_time_and_fee_paired check (
    (realtime_clicked_at is null and realtime_base_fee_baht is null)
    or (realtime_clicked_at is not null and realtime_base_fee_baht in (299,499))
  );

comment on column public.booking_requests.realtime_clicked_at is
  'Server transaction timestamp when final realtime call request reaches RPC. Not technician dispatch timestamp.';
comment on column public.booking_requests.realtime_base_fee_baht is
  'Auditable base callout tier, computed from server received click in Asia/Bangkok. Excludes road overage and is NOT final payment authorization.';

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
  v_click_at timestamptz := transaction_timestamp();
  v_booking uuid;
  v_existing public.booking_requests%rowtype;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_mode = 'IMMEDIATE' and not public.is_immediate_service_open(v_click_at) then
    raise exception 'OUTSIDE_IMMEDIATE_SERVICE_HOURS';
  end if;
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
      address_verification_status='PENDING_OPERATOR_REVIEW',
      realtime_clicked_at=case when p_mode='IMMEDIATE' then v_click_at else null end,
      realtime_base_fee_baht=case when p_mode='IMMEDIATE' then public.booking_price_baht(v_click_at) else null end
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
  text,text,text,text,text,text,numeric,numeric,text,text,text[],boolean,uuid,text,timestamptz,timestamptz
) to authenticated;
