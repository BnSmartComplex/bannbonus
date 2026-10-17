# Chang24 / ช่างเดย์เนรมิตร — Thai road map and location details

**Decision date:** 2026-10-18. **Status:** Code complete in draft PR, not deployed or accepted in production.

## Selected technology
- **Base cartography:** OpenStreetMap road/place data displayed via **OpenFreeMap** vector tiles and **MapLibre GL JS** (pinned UMD and CSS to v5.12.0). No Mapbox subscription/token is required for base map rendering. Use Thai labels from OSM's `name:th` / `name_th` when present, then mapped local name as fallback. Missing Thai names must never be hallucinated or translated as verified signs.
- **Driving route:** **openrouteservice** geoJSON `driving-car`, server-only key `OPENROUTESERVICE_API_KEY`; origin is owner-supplied verified Day Neramit Google Maps location coordinate 13.8692121,100.4110222 (not an unrelated viewport center). Destination is the **customer-confirmed map pin**. Response includes actual routing-provider road distance, approximate driving time, polyline, and road names from OSM steps rendered with Thai turn verbs. No haversine/straight-line billing.
- **Visible Thai address breakdown:** Customer enters and confirms **ตำบล (required)**, **หมู่ที่ (optional because some properties don't have a Mu number)**, **ซอยหรือถนน (optional)**, and full house address. These fields appear beside the blue customer pin; they're concatenated into private `booking_requests.service_address`, preserving the existing authenticated Chang24 RPC. Never infer a Mu number or an official subdistrict from coordinates when OSM does not verify it.
- **Pricing preserved:** Realtime 10:00–20:59 299 THB; 21:00–01:59 499 THB; outside hours Booking; first 5 km included, extra road km rounded UP to a whole km at +10 THB/km. Popup shows actual overage km, rounded chargeable kilometres and combined total. No confirmed route => no price to collect.
- **Accessibility and privacy:** A customer may click/tap the map or opt into browser GPS; browser permission is requested ONLY by explicit button click. Users must check the pin matches the actual entrance and explicitly confirm it. If GPS denied or map unavailable, Booking/manual address is still possible; realtime price remains blocked until road distance is verified. No public GPS values logged in application code. OSM map attribution is retained.
- **Limits:** OpenFreeMap is a map tile server, NOT a routing/geocoding service. Openrouteservice free/public tiers require credentials, provider quotas and monitoring. The API key is currently UNCONFIGURED on Vercel; no genuine route was successfully called yet. ORS route duration is an estimate without guaranteed live traffic; do not label as live traffic.
- **Remaining E2E gates:** Render MapLibre on mobile, validate Thai fonts/glyphs and street labels at office and example customer addresses, verify office driveway access vs map POI pin, ensure OSM/ORS route returns correct road entry, rate-limit provider requests, test client popup + persisted accepted price and Supabase RLS. Production promotion separately approved; no subscription/purchase authorized.

## Reference guidance
- [OpenStreetMap Thailand naming and addressing](https://wiki.openstreetmap.org/wiki/Thailand/Naming_and_Addressing): `addr:subdistrict`, `addr:place=หมู่ที่...`, road/soi conventions.
- [MapLibre language override](https://maplibre.org/maplibre-gl-js/docs/examples/change-a-maps-language/).
- [OpenFreeMap](https://openfreemap.org/) tile hosting and vector styles.
- [openrouteservice API](https://openrouteservice.org/dev/#/api-docs).
- [PR #14](https://github.com/BnSmartComplex/bannbonus/pull/14) includes tests for route parsing, Thai route steps and fee rounding.

## Future prevention
Pin version of mapping library; no implicit geocoding for money; mark all addresses unverified until checked; offer typed address fallback; use server secret quotas and server-side abuse controls before Production; audit OSM data for missing Thai street/soi names before UAT, never invent `หมู่ที่`; store a verifiable customer-consent and route-price snapshot before automatic dispatch or charging.
