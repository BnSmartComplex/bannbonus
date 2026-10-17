# ADR 0005 — Chang24: office-origin road route and customer-click tariff

**Status:** Owner-approved pricing rules; implementation in draft PR pending acceptance.
**Effective owner clarification:** 2026-10-18.
**Scope:** ช่าง24 / ช่างเดย์เนรมิตร ONLY. Existing BannBonus general multi-contractor rules are not changed.

## Authoritative current rules
1. **Origin:** [owner-confirmed Day Neramit office](https://maps.app.goo.gl/pY1ei9UqgVJrqxV76) at 2/473 Chittakan Villa 2, Sao Thong Hin, Bang Yai, Nonthaburi. Destination: customer-confirmed address or voluntarily provided/confirmed mobile GPS. Actual DRIVE route distance **office → customer**, not straight line or customer's current location if the appointment is elsewhere. Google Routes `TRAFFIC_AWARE` may provide an estimated journey time; an actual verified office Place ID is not available yet, so never fabricate one.
2. **Realtime click-time base tariff, Asia/Bangkok:** Client can submit immediate call requests at 10:00:00–20:59:59 for a **299 THB** base, or at 21:00:00–01:59:59 for **499 THB** base, with the first **5,000 road metres** included. Outside this interval (02:00:00–09:59:59), disallow immediate call and present **นัดหมายล่วงหน้า (Booking)**, accepted for operator review 24/7.
3. **Owner-approved excess-distance rate:** **10 THB per extra kilometre, rounding *only the excess distance* upwards to a whole kilometre**. For road metres `D`: `excessMetres = max(0, D - 5000)`; `chargedExcessKm = ceil(excessMetres / 1000)`; `extraBaht = chargedExcessKm * 10`; `totalBaht = baseBaht + extraBaht`. Exactly 5,000 m incurs zero excess. 6,200 m incurs 1,200 excess metres, rounded to 2 billable km, +20 THB, giving **319 THB day** or **519 THB night**.
4. **Customer must see an explicit popup** before submitting realtime call: total driving distance, actual excess km, billable rounded-up excess km, rate, base fee, extra charge and combined total. The displayed clock instant before confirmation is a **preview**, whereas the official click timestamp/base bracket comes from the backend's own transaction clock at final submission. Operator must confirm that the customer actually accepted an accurate fee before assigning/dispatched. Do not automatically bill or invent a route.
5. **Availability and privacy:** Booking intake doesn't guarantee available technicians or confirmed appointment. Present only Bang Yai and Bang Bua Thong as active local coverage. Use verified server-side district, technician availability, audit and tenant-level security. Do not log mobile GPS publicly. Customer can decline geolocation and type a full service address. Never claim a valid route price without Google Routes or verified alternate provider.
6. **Deployment controls:** `GOOGLE_ROUTES_API_KEY` is not currently available, and activating Google's paid routing requires reviewed credentials/quotas. The approved 10 THB/km pricing formula is a code constant under `src/modules/booking/service-policy.ts`; no other environment values are required for pricing. Backend persisting the **final road-distance route snapshot and consent/accepted total** remains incomplete; don't promote to production or enable payment/dispatch until security and browser E2E checks pass.

## Precedence and supersession
This scoped decision supersedes earlier Chang24 assumptions that the base rate was fixed when the technician **left** the office or arrived at the customer's home, and supersedes the former **unapproved** status of the +10 THB/km surcharge. The owner explicitly approved both the 10 THB/km rate and full-km rounding. It does **not** amend unrelated BannBonus or independent contractor price agreements.

## Verification and rollback
- `src/lib/realtime-quote.test.ts`: start/end of price windows; exactly 5 km; 5,001 m; 6.2 km day/night; rounded billable distance; missing map or invalid distance protections.
- `src/lib/office-route.test.ts`: Routes duration parsing and estimated office→destination arrival.
- `supabase/migrations/0008_chang24_service_address.sql` and `0009_chang24_realtime_click_price.sql`: isolated location/request-time audit in Chang24 test database; no production changes.
- `supabase/tests/chang24_service_location_regression.sql`: permissions, invalid area, location records and daytime/nighttime backend boundary validation.
- Code rollback: revert/close branch PR. Test DB rollback requires reviewed follow-up migration; never delete historical production records.
