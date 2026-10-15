# GOLD — ช่างออนไลน์ 24 ชั่วโมง / BannBonus BNSmart
Version: 1.0.0 | Status: APPROVED REQUIREMENTS / PRE-IMPLEMENTATION | Date: 2026-10-15
Repository: BnSmartComplex/bannbonus | Canonical business and system specification.
## Mission and boundaries
Build a trustworthy mobile-first field-service SaaS platform for a **real team of three**. Customers may request service or make booking requests 24/7; **24 hours does not promise technician availability**. Initial coverage: **Bangkok and Nonthaburi only** (exact zones and pricing to be configured; never infer them). Existing LINE Official Account and LINE team group are confirmed; credentials, bot installation and API integration are NOT confirmed.
Booking policy: **human team approval is mandatory** before a booking is confirmed. No shift/roster/check-in-to-shift system. Technicians explicitly toggle ONLINE/OFFLINE, while operational states derive from jobs.
## Non-negotiable invariants
1. Source of truth is backend database; LINE, web, PWA and agents are clients. No UI/AI-only state mutation.
2. Technician ONLINE does not mean AVAILABLE. Active assignment, en-route, on-site, working, wrapping-up/unchecked-out or conflicting booking blocks immediate dispatch.
3. Request received != technician accepted != technician dispatched != booking confirmed. Customer wording must reflect verified state.
4. Immediate dispatch requires eligibility check (online, active job, check-in/out, skills, area, schedule conflicts, freshness); atomic accept/assignment; never double-assign.
5. No available technician -> offer BOOKING_REQUEST with actual conflict-aware suggested windows; human approval -> BOOKING_CONFIRMED. Customer may request slots but must never see unverified slot as guaranteed.
6. Booking changes and cancellations must be transactionally consistent, auditable, and customer-notified; handle travel and work-duration buffers.
7. All write commands are authorized, validated, idempotent and audited; high-impact AI actions require explicit human confirmation.
8. LINE group receives minimal PII, signed webhook verification, retry and outbox. Do not use discontinued LINE Notify. Missing credentials means NOT CONNECTED, never claim integration is live.
9. BN Tactical is decision support, not independent safety authority; cite approved manuals/evidence, record measurements as technician-supplied, escalate electrical/gas/other hazardous work and uncertainty. No fabricated prices, availability, test results, warranties.
10. Separate tenant_id in business data and enforce tenant isolation from day one; single operating tenant initially. Keep system lean for three users.
11. PDPA/privacy-by-design, least privilege, consent for case-study content, encryption, retention and deletion workflows, backups and tested restoration.
12. GitHub changes through scoped branches/PRs and review; GOLD and state machine contract changes require human approval.
## User journeys
Customer: SEO landing -> service request (web/LINE/phone manually logged) -> immediate dispatch eligibility -> technician offer/accept -> arrival updates -> quote approval -> job completion/QC/payment/warranty; OR booking request -> team approves/rejects/proposes new slot -> customer notified -> assigned service.
Technician: login -> toggle ONLINE -> view accepted job -> EN_ROUTE -> check-in -> diagnostics/checklist/photos -> quote -> repair/QC -> checkout; offline drafts can sync but cannot independently accept or confirm work.
Operator: see live team status and inbox, approve bookings, override exceptional cases with reason, manage LINE delivery failures, inspect audit trail.
## Phased scope
P0: documentation, domain model, state transitions, threat model, API and test contracts.
P1: intake, auth, status, dispatch, booking approval, team dashboard, LINE adapter/outbox and operational audit.
P2: technician PWA, diagnostics, AI copilot with safety guardrails, evidence and checklist.
P3: parts, verified supplier pricing, quotes/approvals, QC, receipts, warranty.
P4: analytics, knowledge governance, reviewed SEO/case studies and automation.
## Acceptance gates
Never announce available technician while active job or unchecked-out; concurrent accepts cannot assign twice; simultaneous bookings cannot overlap; booking is never confirmed without authorized staff action; webhook replay has no duplicate effects; failed LINE push remains visible and retryable; offline stale state cannot authorize accept; tenant isolation tested; recovery procedure tested.
## Open decisions (do not guess)
Service categories and qualifications, exact zones, travel buffers, quote/pricing rules, customer identity and payment provider, LINE credentials/group ID, tech identities, booking cancellation policy, operating hours of actual human response, chosen hosting stack. Defaults must be documented as provisional and configurable.
## Document precedence
GOLD.md > docs/STATE-MACHINES.md and docs/API-CONTRACTS.md > docs/ARCHITECTURE.md > AGENTS.md > implementation. In conflict, stop and propose an ADR; never silently change GOLD.

## Official AI product naming
The technician diagnostic AI assistant's official product name is **BN Tactical** (formerly referred to as อาจารย์ช่าง). BannBonus is the customer brand; BNSmart is the operating platform. All future UI, agent labels and documentation must use BN Tactical.

## Universal equipment intake and pre-dispatch research (confirmed)
- Accept booking requests for **all equipment categories from day one**, including an Other/Unknown category. This does NOT claim verified technical coverage of every model.
- Require a detailed fault description (symptoms, onset, error codes where known). Require **either** both brand and model **or** at least one uploaded equipment photo when brand/model cannot be supplied. For missing/uncertain identification, request equipment overview and nameplate photos when available; never invent a model.
- Backend validates the requirement, not only client UI. Secure photo uploads, file validation, access control, privacy and retention apply.
- On successful booking request creation, asynchronously enqueue equipment identification and manufacturer-first manual/spec/error-code research. Do not block booking on research availability; keep booking status PENDING_REVIEW until human team confirmation.
- Research results must include provenance, exact model/revision applicability, verification status, retrieval time and unresolved questions. BN Tactical uses only attributed evidence and presents uncertainty; human technician approves risky diagnostic/repair actions.
- Coverage policy: intake all categories; research on demand at booking plus curate reusable verified device knowledge. No unsupported promise of complete catalog or automatic diagnosis.

## Confirmed: booking-first pre-diagnostic device dossier
On booking intake, extract candidate brand/model/category from customer text and equipment/nameplate images. Present candidates and evidence to customer for explicit response CONFIRMED / UNSURE / UNKNOWN / REJECTED (plus free-text correction). Customer confirmation is not proof of manufacturer-level identity. Begin provisional research immediately even if customer is unsure, unknown or does not respond; never force guessed model. Prepare a cached, tenant-authorized, job-linked technical dossier BEFORE field visit whenever source data is available, so technician PWA can open it immediately without initiating a new research run. Dossier must contain (1) model-specific specifications, (2) components, functions and **verified quantities only when authoritative BOM/parts list exists**, (3) common failures with model-specific vs category-general provenance clearly separated, and (4) ranked, evidence-grounded cause hypotheses and discriminating observations/tests. Every claim includes source, applicability, retrieval time, confidence/verification status; missing data is explicit. Store immutable version/snapshot with refresh mechanism, encrypted/authorized access, and local offline cache where feasible. Booking remains human-confirmed; research failure must not block request creation or fabricate details.

## Confirmed customer vs internal technical disclosure policy
Research all four dossier categories internally from booking time. Customer-facing views expose only (1) non-sensitive device specifications, (2) high-level component names/functions and verified quantities where available, and (3) general/common symptoms with proper model-specific provenance. Never expose category (4) root-cause hypotheses, ranked diagnoses, troubleshooting decision trees, test points, measurement procedures, repair instructions, part-replacement recommendations, internal evidence reasoning, or internal diagnostic prompts to customers. Avoid indirect leakage of diagnosis through customer-facing component/failure descriptions. Authorized technicians/operators see the complete technical dossier. Enforce this at backend API projection and RBAC, not merely hidden UI tabs; redact exports, notifications, caches and logs. Customer still receives transparent booking status, service terms, pricing/quote and safety-critical warnings as appropriate; do not misrepresent diagnosis or conceal safety information. Human approval still required for booking confirmation.

## Confirmed: customer-facing visual device comparison
At booking, fetch a legitimately reusable reference product image for each plausible candidate model (OEM/manufacturer preferred) and show it alongside any customer-uploaded equipment image. Display brand/model, source, and whether the image is exact-model verified or illustrative only. Let customer respond CONFIRMED/UNSURE/UNKNOWN/REJECTED; continue research regardless. Never claim that visual similarity alone verifies exact model/revision. If no trusted/licensed reference image is available, show a clear no-reference state rather than unrelated stock imagery. Secure customer photos and strip metadata as appropriate; enforce access controls, licensing and image-source attribution. Public display must not reveal internal diagnostic hypotheses.
