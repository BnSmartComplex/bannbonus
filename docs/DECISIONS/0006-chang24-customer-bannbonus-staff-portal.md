# ADR — Customer and staff website split (owner direction 2026-10-18)

**Web properties:** `chang24.vercel.app` is the **customer** website for Day Neramit: service catalogue, call technician, 24/7 advance appointment requests, price popup, login, customer job tracking. `bannbonus.vercel.app` is the **internal technician/admin** website: role-gated staff dashboard, operator bookings, staff worklist and technician jobs.

## Technical boundary
- Two existing Vercel projects build from one codebase, each setting `NEXT_PUBLIC_APP_PORTAL`: `CUSTOMER` on `chang24`, `STAFF` on `bannbonus`. Build environment must be set BEFORE deployment. Both production and the scoped preview branch have the intended mode configured. **Adding env vars alone does not change an already-built deployment.**
- `src/middleware.ts` blocks customer routes on staff project and staff routes on customer project, and blocks customer route APIs on staff. Server homepage/layout change menu and metadata based on the app mode. Staff pages must not become linkable from customer navigation.
- `StaffRoleGate` checks authenticated Supabase `tenant_memberships`: `tenant_admin`/`operator` may open /staff and /operator/bookings, `technician` may open /technician/jobs. Mere authentication is insufficient. Staff login cannot create a new account; it only allows previously provisioned staff. Actual protected data is enforced by Supabase RLS, backend RPC checks and tenant scope. Client gating is extra UX protection, not a substitute.
- Customer and staff **must point to the SAME authorized backend database and booking tenant** within the same environment, rather than fragmenting job records. Preview keys for both projects are scoped to the same **chang24-test** backend only. Never attach the TEST DB to live production.
- Current Production Supabase environment variables are absent on the Vercel projects. No production staff accounts have been verified. Do not claim that either app can process end-to-end production jobs yet.
- Staff root no longer shows the customer marketing homepage; customer site must not show Admin/staff nav. Staff portal metadata is `noindex`.

## Verification and release gates
- `src/lib/portal-mode.test.ts`: route visibility rules for both modes.
- `src/app/login/page.tsx`: redirects signed-in user to the correct portal and forbids staff self-registration.
- GitHub CI for PR current head; Vercel preview for EACH project (staff and customer), and authenticated browser UAT with real test operator, technician and customer roles in the same test database.
- Vercel build-rate limit currently blocks latest preview deploys; do not bypass by merging unreviewed code into production or upgrading account without explicit approval.
- Preserve existing production deployment/data until screenshots, RLS and E2E checks pass. Production promotion is a separate approved step; never assume `READY` means feature acceptance.
