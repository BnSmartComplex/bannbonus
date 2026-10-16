# Architecture — Pre-implementation blueprint
## Topology
Customer Web / Technician PWA / Operator Dashboard / LINE OA + Group
-> Authenticated API / webhook ingress -> Domain services (Intake, Dispatch, Booking, Job Lifecycle, Quotes, AI Tools, Content)
-> transactional PostgreSQL (tenant-aware), event outbox, object storage, job workers
-> LINE Messaging API, AI provider, future payments/suppliers.
Observed 2026-10-16: existing Next.js app on Vercel project bannbonus (meena-team); Supabase chang24-test has the intake schema. Vercel has no configured environment variables, so its previews are not connected to that database. The topology below remains a target, not deployed end-to-end functionality.
## Modular monolith first
For the initial operation prefer one backend with strongly separated modules rather than microservices. Keep stable API contracts and event interfaces for later extraction. Multi-tenancy: tenant_id on tenant-owned records, tenant-scoped auth, indexes and policies; single tenant at launch.
## Source-of-truth and concurrency
Persist technician_online boolean separately from computed availability. Operational states derive from active job and visit transitions. Dispatch accept uses transaction, row locks or equivalent conditional writes plus unique constraints to guarantee no conflicting active assignments. Booking confirmation requires authorized human actor, transactionally rechecks overlaps, creates reservation and emits event. Use time ranges in Asia/Bangkok at UI and UTC instants in database.
## Events and messaging
Transactional outbox stores events in same commit as business mutation. Worker pushes minimal-P​​II LINE notifications with retry/backoff and idempotency; delivery failures remain in admin inbox. Verify LINE webhook signature, deduplicate webhook event IDs, avoid processing untrusted text as instructions. Define at-least-once handling.
## Reliability
Stale heartbeats are not sufficient proof of availability. Connectivity loss blocks new dispatch/booking confirmation but permits local non-authoritative drafts. Monitor API errors, delivery failures, stuck check-ins, overdue jobs, booking approvals, duplicate-event rates. Backup and restore rehearsal before launch.
## Security
Roles customer, technician, operator, tenant_admin, platform_admin (platform admin dormant initially). Enforce tenant isolation in API and DB, least privilege, short-lived signed access, upload scanning, audit logs, PDPA consent/retention, rate limits, webhook validation. Encrypt sensitive data at rest and transit.
## Implementation packages proposed
apps/web (customer); apps/technician (PWA); apps/admin; packages/domain (state machines and rules); packages/db; packages/agents; packages/integrations. These are proposed folders, not current code.
## Architecture decisions pending
Production provisioning/auth onboarding, queue, telemetry, secrets, LINE Messaging API channel credentials, job taxonomy, verified road routing and excess-distance rounding. Core dispatch hours/base fees are in GOLD.md.
