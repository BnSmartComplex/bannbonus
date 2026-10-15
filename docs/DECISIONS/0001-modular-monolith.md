# ADR 0001 — Modular Monolith, Human Booking Approval
Status: Accepted as initial architecture direction, subject to implementation review.
Context: real team of three, online/offline status and operational job state, manual booking confirmation, LINE OA and group available but API unconfigured, multi-agent ambition.
Decision: build a tenant-aware modular monolith with deterministic transactional dispatch and booking services, asynchronous notification outbox and on-demand AI agents. Human operator must approve every booking. No shift management.
Consequences: simpler operations and testability; future SaaS tenants supported through tenant boundaries. AI and LINE cannot become independent sources of truth. Hosting/vendor selection remains open.
