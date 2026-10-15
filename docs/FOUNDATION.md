# Phase 1 Foundation — BannBonus

## Source of truth
GOLD.md takes precedence over this document. Existing state machines, API contracts and tests remain authoritative. This foundation does not implement bookings, dispatch, LINE, BN Tactical or authentication.

## Architecture
Next.js App Router and strict TypeScript frontend, modular domain boundaries under `src/modules`, future PostgreSQL tenant-scoped transactional backend and outbox. Initial operating tenant: one; tenant isolation required from day one. No production provider or credentials configured.

## Operational safeguards
Never claim technician availability from online presence. Booking requires human approval. No live LINE integration. No mock customer records, equipment evidence or invented service pricing. Customer-facing technical dossiers must exclude private diagnostic reasoning.

## Next implementation gates
1. Confirm hosting, auth, database and queue through an ADR before provisioning.
2. Implement real authenticated tenant context and database RLS with cross-tenant tests.
3. Implement intake with equipment photos, validation and durable outbox.
4. Add deterministic dispatch/booking state machines and concurrency tests.
5. Integrate LINE only after credentials, signature verification, idempotency and human approval flows are verified.

## Local development
Node 22; run `npm install`, `npm run lint`, `npm run typecheck`, `npm run build`, then `npm run dev`. No deployed integrations are implied.

## Deployment
Not production-ready. Require security review, CI success, staging, backup/restore, secrets, and operational sign-off.
