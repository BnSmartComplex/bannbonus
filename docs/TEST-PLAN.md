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
- Migration 0002 remains an unmerged initial migration; an independently migrated environment requires a separately reviewed forward migration.

### Release verification

- CI and Vercel Preview must be checked against the new commit SHA; baseline `1852af2` results do not transfer to this change.
- No production deploy, persistent production migration, or billing activation is part of this PR.
