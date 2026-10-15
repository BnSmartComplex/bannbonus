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
Each test needs actual implementation evidence and pass/fail record. No tests have been executed yet.

## Customer technical disclosure acceptance cases
- Customer with valid booking can see only public specs, high-level component descriptions and general/common symptoms; no ranked causes, diagnostic procedures, replacement recommendations, private reasoning or source fragments that reveal them.
- Customer cannot obtain full dossier by changing URL, API route, GraphQL fields, exports, cache, push notifications, LINE messages or forged roles; expect 403 or sanitized response.
- Assigned technician/operator sees full dossier with evidence and readiness state; unrelated technician and cross-tenant users are denied.
- Customer receives essential safety warnings, accurate booking status and applicable service terms without exposure of internal diagnostic work.
