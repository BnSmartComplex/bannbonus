# Phase 1 Foundation — BannBonus

## Source of truth
GOLD.md takes precedence over this document. Existing state machines, API contracts and tests remain authoritative. The repository now contains a booking-intake/authentication starter for review; it does not implement dispatch, booking approval, LINE, or BN Tactical.

## Architecture
Next.js App Router and strict TypeScript frontend, modular domain boundaries under `src/modules`, and a proposed Supabase/PostgreSQL tenant-scoped backend/outbox represented by an unrun starter migration. Initial operating tenant: one; tenant isolation required from day one. Hosting/database choices remain open pending ADR; no production provider, project, or credentials are configured.

## Operational safeguards
Never claim technician availability from online presence. Booking requests remain pending and require human approval. The staff page is read-only. No live LINE integration. No mock customer records, equipment evidence or invented service pricing. Customer-facing technical dossiers must exclude private diagnostic reasoning.

## Next implementation gates
1. Review the starter and confirm hosting, auth, database and queue through an ADR before provisioning.
2. Validate authenticated tenant context, migration and database RLS with cross-tenant tests before using real data.
3. Harden intake/photo lifecycle, add idempotency and verify the durable outbox.
4. Add deterministic dispatch/booking state machines and concurrency tests.
5. Integrate LINE only after credentials, signature verification, idempotency and human approval flows are verified.

## Local development
Node 22; run `npm install`, `npm run lint`, `npm run typecheck`, `npm run build`, then `npm run dev`. No deployed integrations are implied.

## Deployment
Not production-ready. Require security review, CI success, staging, backup/restore, secrets, and operational sign-off. See [Chang24 source import review](CHANG24-SOURCE-IMPORT.md) for prototype scope and limitations.
