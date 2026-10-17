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

## Release-blocker regression evidence (2026-10-17)

- `supabase/tests/booking_approval_regression.sql` now contains 42 rollback-only pgTAP assertions covering operator/admin directory authorization, tenant isolation, duplicate approval retries, invalid/backward technician transitions, idempotent status requests, cancellation-to-booking reconciliation, duplicate booking requests, overlap constraints and Bangkok boundaries.
- The directory RPC is the only operator picker source; it is SECURITY DEFINER but returns rows only after checking operator/tenant_admin membership for the requested tenant.
- `scripts/booking-approval-concurrency.mjs` performs a real two-authenticated-session exact-approval race against a disposable project and asserts one appointment id and one appointment row.
- `src/lib/schedule.ts` validates real calendar dates, future ranges, end-after-start, and converts Asia/Bangkok wall-clock values to UTC before the RPC.
- Advance bookings remain free. Appointment storage is explicitly `estimated_dispatch_fee_baht` with `payment_status = NOT_CHARGED` and a null actual fee; no payment API or billing write exists.

### Credential-gated checks

- GoTrue Auth sign-in/session expiry, Storage HTTP upload/read denial and the two-session concurrency harness require isolated Supabase credentials. Missing credentials are an external blocker, not a code failure.
- Run the SQL regression only in a disposable PostgreSQL/Supabase project with migrations 0001 and 0002 loaded. Never run it against production.
- Booking migration 0003 remains unmerged and unapplied to hosted environments; an independently migrated environment requires a separately reviewed forward migration.

### Release verification

- CI and Vercel Preview must be checked against the new commit SHA; baseline `1852af2` results do not transfer to this change.
- No production deploy, persistent production migration, or billing activation is part of this PR.

### Executed database verification (2026-10-17)

- Read commit 9bbbcb2 through the GitHub connector despite shell checkout restrictions.
- Executed its migration 0002 and SQL suite on the isolated chang24-test PostgreSQL 17.11 project inside one BEGIN/ROLLBACK session.
- The original suite planned 42 but executed 41 assertions. Its cancellation assertion also attempted to read a customer booking as a technician; self/role-scoped RLS correctly hid that row.
- Fixed only the test: verify cancellation with the authorized tenant operator, resume technician checks, and add customer directory-access denial. No application permissions or business state transitions changed.
- Corrected suite: 42 assertions executed, 42 passed, no plan mismatch.
- Database-role/JWT-subject checks exercise PostgreSQL RPC/RLS, not GoTrue authentication, HTTP JWT validation or Storage HTTP behavior.
- All migration, extension and fixture changes were rolled back; no permanent migration was applied.
- Real Auth/Storage HTTP and two-session concurrency remain unexecuted. The concurrency script's existence is not execution evidence.

### Disposable local HTTP integration gate

- Workflow: .github/workflows/supabase-integration.yml; harness: scripts/local-supabase-integration.mjs.
- Each runner starts real local Supabase Postgres/Auth/REST/Storage using CLI 2.75.0, applies repository migrations and runs the pgTAP suite before HTTP tests. No hosted project credentials or billing are used.
- The harness refuses non-loopback API/database hosts and requires SUPABASE_LOCAL_TEST_CONFIRM=DISPOSABLE_LOCAL_STACK. Local status keys stay in a private runner-temporary file and are never uploaded.
- Tests cover five password sign-ins, bad-password denial, private PNG upload/download, cross-user/anonymous read denial, cross-user overwrite/path denial, HTTP RLS/directory access, technician transitions and cancellation reconciliation.
- Five exact approval races begin with fresh pending bookings and assert one returned appointment id, one row, one audit event and NOT_CHARGED. Three competing-booking races assert one winner and one pending loser for one technician slot.
- Auth uses a genuinely issued 60-second access token: wait until expiry, assert Auth/REST denial, refresh successfully, sign out and assert the refresh token cannot be reused.
- Cleanup always removes local containers/volumes. Hosted migrations, Production and Payment remain unchanged.
- Workflow execution evidence is recorded in PR #8 only after the actual run completes; adding a harness is not a passing test result.

### Fresh-stack migration ordering

A full local startup exposed duplicate version 0002 in atomic booking approval and RLS performance hardening. The unmerged booking migration is renamed to 0003_atomic_booking_approval.sql; 0002_rls_performance_hardening.sql is preserved. Fresh databases must apply 0001, 0002 (RLS hardening), then 0003 (booking). No hosted migration history is changed or repaired. Historical rollback-only evidence above used the previous booking filename.
