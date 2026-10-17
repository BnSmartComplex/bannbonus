# Acceptance Test Plan — pre-implementation
P0 invariants:
T01 online technician checked into JOB-102 cannot be offered immediate job.
T02 online technician EN_ROUTE cannot be offered another overlapping job.
T03 checkout does not imply AVAILABLE if OFFLINE or next booking conflicts.
T04 two technicians accepting same offer/job concurrently -> exactly one winner.
T05 one technician receiving two concurrent assignments -> at most one active conflicting assignment.
T06 two customers request same booking slot -> no double confirmation.
T07 customer booking selection remains PENDING_TEAM_REVIEW; only authorized team confirms.
T08 unverified/stale availability -> pending or booking path, never promise.
T09 LINE webhook invalid signature rejected; replay idempotent.
T10 LINE push failure visible in admin inbox, retryable, no lost job.
T11 offline technician draft sync never performs stale assignment.
T12 role and tenant isolation reject cross-tenant reads/writes.
T13 cancellation/reschedule releases/reallocates capacity safely.
T14 override requires authorized actor, reason, audit.
T15 AI cannot bypass safety or commit price/booking/dispatch without approved server transition.
T16 customer-facing 24/7 messaging never promises 24/7 technician availability.
T17 timezone Asia/Bangkok date boundaries and DST-neutral UTC storage.
T18 backup/restore and outbox recovery rehearsal before production.
Each test needs actual implementation evidence and pass/fail record. Focused executed checks are recorded below; all other acceptance cases remain unverified.

## Customer technical disclosure acceptance cases
- Customer with valid booking can see only public specs, high-level component descriptions and general/common symptoms; no ranked causes, diagnostic procedures, replacement recommendations, private reasoning or source fragments that reveal them.
- Customer cannot obtain full dossier by changing URL, API route, GraphQL fields, exports, cache, push notifications, LINE messages or forged roles; expect 403 or sanitized response.
- Assigned technician/operator sees full dossier with evidence and readiness state; unrelated technician and cross-tenant users are denied.
- Customer receives essential safety warnings, accurate booking status and applicable service terms without exposure of internal diagnostic work.

## Atomic approval database regression evidence (2026-10-17)

- Baseline PR #8 (d1267346): 5 of the initial 17 database regression assertions failed.
- Corrected migration: 27/27 pgTAP assertions passed on the isolated chang24-test PostgreSQL 17 project.
- Tests set the authenticated database role and JWT subject for permission/RLS checks. They do not exercise GoTrue sign-in or HTTP JWT verification.
- Migration 0002, extension changes and all randomly identified test fixtures were executed inside BEGIN/ROLLBACK. Post-run checks confirmed the appointment table and fixture tenants were absent. No persistent migration or production change was made.
- Covers exact retry, changed-payload rejection, same/cross-tenant overlap, global database exclusion constraint, finite ranges, role/tenant denial, RLS, one audit event, revoked technician membership and Bangkok price boundaries.
- Regression SQL: supabase/tests/booking_approval_regression.sql. Run with pg_prove against an isolated database with migrations 0001 and 0002 loaded, or within a single rollback-only SQL session after loading migration 0002. Never run against production.
- Migration 0002 is still an unmerged initial migration. This revision edits it in place; any independently migrated environment needs a separately reviewed forward migration, not reapplication of this file.

### Remaining release gates

- Real Auth session expiry, Storage HTTP upload/read denial and simultaneous multi-session approval remain untested. Sequential overlap tests and a database exclusion constraint are not a claimed concurrency test.
- Operator UI queries technician memberships through a self-only RLS policy, so it cannot list other technicians. Add a scoped staff directory/RPC and verify the UI before release.
- Technician status RPC still lacks an enforced transition graph and booking cancellation reconciliation. Complete these against the approved state-machine contract; do not treat the current UI button sequence as backend enforcement.
- Price helper currently uses scheduled start. GOLD specifies customer-confirmed dispatch time and free advance booking requests. The stored value must remain an estimate, with billing disabled until the dispatch approval flow exists.
- Re-run CI and inspect Preview for the follow-up commit. Do not transfer baseline CI/Preview results to a changed commit.
- Preserve the P0 and technical disclosure acceptance cases above. Passing this focused regression suite does not satisfy all release gates.
