# ช่างออนไลน์ 24 ชั่วโมง — BannBonus / BNSmart
Planning repository for a Bangkok + Nonthaburi field-service platform operated by three technicians.
**Current status: specification-led application starter.** The web intake/authentication prototype is not connected to a production database and is not deployed.
Read [GOLD.md](GOLD.md) (business source of truth), [AGENTS.md](AGENTS.md) (multi-agent governance), [Architecture](docs/ARCHITECTURE.md), [State Machines](docs/STATE-MACHINES.md), [API Contracts](docs/API-CONTRACTS.md), [Test Plan](docs/TEST-PLAN.md).
Confirmed: existing LINE OA + team group; all Booking requests require human team approval. No shift roster. Customers can submit requests 24/7, not guaranteed technician response 24/7.
Next: review open decisions in GOLD, approve hosting/database architecture through an ADR, complete security and workflow gates, then integrate external services safely.

## Phase 1 foundation (2026-10-15)
A Next.js/TypeScript application shell, modular domain boundaries, CI checks and an environment-variable template have been added. See [Foundation](docs/FOUNDATION.md) for architecture, local setup, limitations and release gates.

**Not production-ready:** the Supabase integration is a starter proposal only; no production database, real customer records, dispatch, booking confirmation, LINE integration, BN Tactical agent or deployment is configured. The existing GOLD specification remains authoritative. See [starter review and limitations](docs/CHANG24-SOURCE-IMPORT.md).
