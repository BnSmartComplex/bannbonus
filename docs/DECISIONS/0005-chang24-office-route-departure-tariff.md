# ADR 0005 — Chang24 office-origin driving distance and actual-departure tariff
**Status:** Chang24 owner-directed change, pending final operational acceptance. **Date:** 2026-10-18
**Applies ONLY to:** ช่าง24 / Day Neramit local tenant. General BannBonus contractor-dispatch rules remain unchanged.

## OWNER OVERRIDE — 2026-10-18 (this section supersedes earlier departure-fee text)
- **Realtime 10:00–20:59 = 299 THB base (first 5 km); 21:00–01:59 = 499 THB base; 02:00–09:59 = no realtime request; offer Booking.**
- **Tariff tier is locked to when the customer finally clicks to submit the realtime call and the server receives it**, not when the technician leaves the office, reaches the destination or is assigned. SQL migration 0009 captures `realtime_clicked_at` and `realtime_base_fee_baht` using database transaction time, not device time.
- Office remains the ONLY route origin; calculate actual driving road km, estimated travel minutes, and excess km `max(0,totalKm-5)`. Extra charge and combined total must appear in a customer popup BEFORE final call submission. Extra charge depends on an owner-approved THB/km tariff AND owner-approved treatment of fractional kilometres. Neither was approved in this conversation. **Do not silently activate the old proposed +10 THB/km.**
- If route cannot be verified or extra tariff is unset, never display a fabricated total; the popup must explain and offer Booking for human review.
- Current popup amount is a preview, and accepted customer charge is NOT yet persisted as a verified final route-price contract. A verified route snapshot and operator/client approved final-charge lifecycle remain necessary before production billing.

## Decision
1. The user-provided office Google Maps pin at https://maps.app.goo.gl/pY1ei9UqgVJrqxV76 identifies **Day Neramit office**. The address is 2/473 Chittakan Villa 2, Sao Thong Hin, Bang Yai, Nonthaburi 11140. An independently verified Google Maps Place ID has not yet been supplied; do not invent one or use map viewport coordinates.
2. Calculate driving **road distance and travel duration from the office TO the customer's confirmed location**. Use an actual routing provider. Never reverse the route, replace it with a straight line, or use the technician's home as origin for Chang24. Routes API supports an office address or explicitly verified Place ID as origin; customer GPS (with consent) or typed destination address is the endpoint. Address geocoding and actual district eligibility remain subject to staff review.
3. The **real departure instant from the office** (server-recorded and staff/customer-authorized) determines the tariff in Asia/Bangkok: 10:00–20:59:59 => 299 THB through 5 km; 21:00–01:59:59 => starting 499 THB through 5 km; exactly 02:00–09:59:59 => no new dispatch. Booking creation time, appointment on-site start time, and arrival time are not departure. User-facing previews clearly say "หากออกตอนนี้"; later actual departure must be recalculated.
4. Routes API uses DRIVE + TRAFFIC_AWARE for road distance and **estimated** traffic-influenced driving time. Treat ETA as a prediction only; do not claim real-time position or guaranteed arrival. The provider has a higher billed SKU for traffic-aware requests; owner approval, server key and quota controls are prerequisites for activating live paid routing.
5. Over 5 km => human quote; no automatic 10THB/km without owner approval. No final fee or actual dispatch until explicit price disclosure/approval and verified route. Never persist an unverified customer-entered road-distance result.
6. City-wide area availability is not the same as confirmed serviceable district. Chang24 only advertises Bang Yai/Bang Bua Thong; human staff validates precise destination and technician ability before offering work. Customer location is sensitive: ask permission before GPS, allow typed address, use RLS and no-store; do not put coordinates in URLs except an intentional navigation link.
7. This PR is deliberately a safe **pre-dispatch preview**: it does NOT claim that `office_departed_at` and customer financial approval are already connected to backend operational commands. Existing `booking_appointments.estimated_dispatch_fee_baht` is legacy scheduled-time-only and must not be presented as a final callout. Implement durable departure timestamp and quote/consent lifecycle in a separate reviewed migration before real dispatch/billing.

## Existing specification conflict
Prior GOLD.md and service policy referenced contractor dispatch bases. This owner change is a Chang24-specific scoped rule. Do not change global BannBonus tenant policy or retrospectively rewrite already-approved booking history.

## Verification
- Unit tests: `src/lib/office-route.test.ts` and `src/modules/booking/service-policy.test.ts` (20:59:59 / 21:00 / 01:59:59 / 02:00, <=5km / >5km, drive ETA).
- Integration: address and district private fields + permissions in `supabase/tests/chang24_service_location_regression.sql`; previous migrations remain immutable.
- End-to-end Google Routes with actual traffic and Auth requires verified Google API project and capped key; without key or provider failure the user gets **NO invented distance or price**. Staff may inspect route in Google Maps manually.
- Existing production remains unmodified; developer changes run in a draft PR and test-only Supabase environment.
