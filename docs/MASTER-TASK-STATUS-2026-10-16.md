# Master task — verified status, 2026-10-16

## Access and deployment
- GitHub read/write access verified for BnSmartComplex/bannbonus. No main merge or force push.
- main: c4bc33d478721a48b9f6c893a6a7ae31d5a837a1; fix/vercel-hobby-build: dc7c23fd6933db2d5289f919b19d918c2c4f1a8b.
- This work branches from docs/booking-pricing-policy-20261016 at 06c75edbc8eb7d534832608cab7fc7216d63f20c, preserving PRs #3 (build), #4 (PWA/lockfile), #5 (policy).
- New branch: feat/booking-policy-pwa-20261016. Review as a stacked PR against the policy branch.
- Vercel existing team meena-team / project bannbonus accessible. Latest pre-change preview: dpl_89fJ5TdE6dX7mqU4gm1Wo97j6eDp, READY at 06c75ed.
- Latest Production deployment: dpl_7zdAa4pCfVkfcFq4Cq1CDdFDDC6b, ERROR, main c4bc33d. Earlier investigation identified vulnerable Next.js 15.5.6; branch stack uses 15.5.28. A passing preview is not a production repair until reviewed changes are merged/deployed.
- Vercel environment listing returned no variables and hiddenProductionEnvCount=0. No Supabase or LINE runtime connection is configured.
- Codex managed environment is still pending/offline, with no credential bindings. Tests ran in a temporary Vercel Sandbox under the existing project, Node 24, not in a functioning Codex executor. No new application project was created.

## Changes implemented in this PR
- Reconcile GOLD, policy and customer wording to the latest owner instruction: ordinary fee 299 during 10:00–21:59; night fee 499 during 22:00–01:59; new dispatch closed at 02:00, Asia/Bangkok.
- Independent-contractor wording, free advance requests with human approval, road-route distance, onsite quote approval and completed-repair labor discount.
- Pure reference pricing module and boundary tests. This is not database-authoritative billing: no quote/assignment/payment endpoint has been enabled.
- Excess distance over 5 km returns review-required, without applying or rounding the proposed 10/km.
- Shared service terms and /pricing. Booking remains an advance-request form, disabled when its backend configuration is absent; no misleading success state.
- PNG 192/512 and Apple touch icon generated from the existing SVG. Existing generic-only offline cache preserved; no customer data or auth responses cached.

## Database verification
Supabase chang24-test (qphwxusdpnsrgtarpzhs) is ACTIVE_HEALTHY. The other existing project qdsicapidyconcjoruim is INACTIVE and was not resumed.
The isolated test project was empty: tenants, memberships, bookings, auth users and equipment-photo objects all zero.
Existing pgTAP suites executed with complete reports captured: 25 structural/security checks + 19 RLS/RPC behavior checks passed. Assertions ran under the original authenticated roles. Only a temporary results table was added to capture the report; all fixtures rolled back.
After tests: tenants, memberships, bookings, research outbox, audit logs, auth users and equipment-photo objects all zero. No permanent database migration was applied.
See [captured TAP](verification/2026-10-16-supabase-tap.json).
Security advisor has one warning for the intentionally callable SECURITY DEFINER create_booking_request RPC. Empty search_path, authenticated-only execution, server validation, membership checks, idempotency and audit were checked. This does not prove every future workflow is secure.
[Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Actual workflow coverage
| Area | Present | Not implemented / not verified |
| --- | --- | --- |
| Customer | Existing-account OTP UI; intake/photos; own requests; tested DB intake RPC | Self-registration/tenant onboarding, real Auth/Storage browser flow, preferred booking slots, quote approval, receipts |
| Contractor | Role definition and denied general-queue access | Presence, eligible offers, atomic accept/assignment, field visit, quote, completion |
| Operator | Tenant-scoped read queue | Human approval with atomic scheduling/conflict checks, reassignment, complaints |
| Owner | tenant_admin membership and tenant read access | Revenue/expense/contractor/system dashboard |
| BN Tactical | Safety/disclosure specs and research outbox row on intake | Research worker, verified dossier, role-scoped projections, AI runtime |
| LINE OA | Integration specification | Credentials, signature verification endpoint, delivery worker/retries and live notifications |
| Pricing | Confirmed rules, UI and tested pure calculation reference | Verified route provider/base coordinates, persisted tenant policy and quote versions, approval and collection |
| PWA | Manifest, raster icons, generic offline fallback and privacy unit tests | Physical Android/iOS installation, offline browser E2E and authorized technician drafts |

Booking is demonstrated only through the test database up to PENDING_TEAM_REVIEW. No booking is automatically confirmed. A current public website user cannot submit a live booking. No concurrent assignment test can pass yet because assignment tables/RPCs do not exist.

## Google Business Profile
The supplied [Maps link](https://maps.app.goo.gl/TNuQPQP3QARkbR946) resolves to **Day Neramit**, Contractor, at **2, 473 Soi Mu Ban Chittakan Villa 2, Sao Thong Hin, Bang Yai District, Nonthaburi 11140, Thailand**.
Live public listing showed **09:00–20:00 every day**. Exact Thai display name and road-routing origin coordinates were not independently verified.
Business Profile opened at business.google.com/locations and redirected to Google Sign-in; no owner session/business list was available.
**No hours were saved.** Intended change remains only Monday–Sunday 10:00–02:00 next day. Name, address, category and all other fields were untouched. No public Suggest Edit was submitted. Owner login/verified management access is required.

## Validation and release limits
- npm ci: passed; npm audit --audit-level=high: 0 vulnerabilities.
- npm run lint, npm run typecheck, npm test (50/50), npm run build: passed in Node 24 sandbox.
- Build emits a non-blocking warning that the Next.js ESLint plugin is absent; do not call lint coverage exhaustive.
- Live Preview/CI verification is recorded in the PR after publishing the branch.
- No production/customer data writes, payment activation, LINE sends, main merge or new application project.

## Next implementation order and owner decisions
1. Establish isolated preview Auth/Storage fixtures and tenant onboarding; wire branch-scoped public Supabase configuration and run the API/Auth/Storage harness. These are engineering tasks, not SQL for the owner to execute.
2. Implement tenant-authorized human review, contractor availability and atomic scheduling/assignment together with concurrency tests; only then expose confirm/accept buttons.
3. Persist verified routes, versioned quotes/customer approvals, completion discount and receipts before enabling any charge.
4. Add owner dashboard from real database aggregates, then LINE outbox delivery and evidence-backed BN Tactical.
5. Complete physical-device PWA and recovery/backup checks before production approval.

Owner input is needed only for Google owner login; approval of excess-distance rounding/charge policy; payment, commission, tax and cancellation terms when that work is reached; and reviewed production release. Route coordinates and exact contractor coverage must be verified, not invented.
Rollback of this PR: revert its commits; no schema/data migration requires reversal.
