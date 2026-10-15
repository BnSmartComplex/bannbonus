# Production Readiness Checklist — Chang24 Service Intake

**Status: BLOCKED — this starter is not ready for Production.** No Supabase project, production credentials, Auth email configuration, or approved deployment environment was used or changed during Phase 2.

## Database and access control

- [ ] Owner approves database/auth/storage/hosting decisions through an ADR; GOLD remains authoritative.
- [ ] Apply and verify migrations in an isolated test environment first.
- [ ] Pass pgTAP schema, grants, RLS, cross-tenant, RPC validation, idempotency, outbox/audit, and transaction tests.
- [ ] Pass API-level Auth/RLS and private Storage owner/cross-user/signed-URL tests.
- [ ] Test concurrent idempotency/retry behavior and verify there is no duplicate booking, outbox, or audit event.
- [ ] Provision tenants and memberships through a trusted administrative process; customer signup must not create roles or memberships.
- [ ] Review storage upload inspection, EXIF handling, malware scanning, staff-photo access, orphan cleanup, and retention.

## Privacy and operations

- [ ] Approve privacy notice, purpose, consent wording/version, retention, data-subject deletion/export, incident response, and named data owner before collecting personal data.
- [ ] Configure rate limits/abuse controls for OTP, RPC, and uploads.
- [ ] Configure monitoring, audit review, backup retention, and perform a restore rehearsal.
- [ ] Verify email redirects and login/logout/session expiry on each approved origin.
- [ ] Confirm customer wording never promises technician availability; requests remain `PENDING_TEAM_REVIEW` until a human process is implemented.

## Product behavior and integrations

- [ ] Implement and test human approval, scheduling, conflict checks, and booking state transitions before claiming confirmed appointments.
- [ ] Implement staff access and assignment-based technician access with tenant/RBAC tests.
- [ ] Implement research worker, evidence provenance, BN Tactical safeguards, and customer-safe disclosure before claiming AI is active.
- [ ] Implement LINE webhook signature validation, replay protection, outbox delivery/retry, and privacy-minimized notifications before claiming LINE is connected.
- [ ] Verify image licensing, model applicability, and explicit customer feedback before showing reference-image matches.

## Deployment

- [ ] Approve and test hosting choice in a preview/staging deployment.
- [ ] Keep staging/preview Supabase credentials separate from Production and server-only credentials out of browser bundles.
- [ ] Review domain/Auth redirect configuration, deployment branch protections, rollback, and cost/ownership.
- [ ] Run the full release test suite on the exact commit intended for release.
- [ ] Obtain explicit production release approval; no deployment is authorized by this checklist.

## Evidence

The current PR has local lint/typecheck/unit/build evidence, but no Supabase integration evidence. See [security review](SECURITY-REVIEW-PR2.md) and the [Supabase test plan](SUPABASE-INTEGRATION-TEST-PLAN.md). Empty or unchecked items are not assumed to pass.
