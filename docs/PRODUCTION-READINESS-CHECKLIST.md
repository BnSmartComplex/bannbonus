# Production Readiness Checklist — Chang24 Service Intake

**Status: BLOCKED — not Production-ready and not deployed.** The user requested a Production release, but the available Vercel account has no linked access to `BnSmartComplex/bannbonus`, `chang24.vercel.app` currently returns `404 DEPLOYMENT_NOT_FOUND`, and no Production Supabase project/environment was identified. The isolated Supabase project `chang24-test` is test-only and must not be used for live customer data.

## Database and access control

- [ ] Owner approves database/auth/storage/hosting decisions through an ADR; GOLD remains authoritative.
- [x] Applied migrations `0001_initial.sql` and `0002_rls_performance_hardening.sql` to isolated `chang24-test` only; test project was empty before migration.
- [x] Read-only verification returned **25/25 structural/grant/RLS/index/bucket invariants as true** after hardening.
- [ ] Capture a complete pgTAP result report and run the API-level Auth/RLS and private Storage owner/cross-user/signed-URL tests.
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

- [ ] Connect the Vercel GitHub App to the `BnSmartComplex` namespace/repository and identify the exact intended Vercel project/team; the currently connected namespace is `dayneramit`, and `search_repo` returned no `bannbonus` repository.
- [ ] Identify and authorize the Production Supabase project separately from `chang24-test`; provision Production Auth email settings and environment variables without exposing server-only credentials.
- [ ] Approve and test hosting choice in a preview/staging deployment.
- [ ] Review domain/Auth redirect configuration, deployment branch protections, rollback, and cost/ownership.
- [ ] Run the full release test suite on the exact commit intended for release.
- [ ] Promote/merge and deploy only after the target infrastructure and all release gates above are available.

## Evidence

The PR has local lint/typecheck/unit/build evidence and partial integration evidence from `chang24-test`. The tenant/RPC test reached its final assertion and test fixtures were rolled back; the full TAP report and API/Auth/Storage checks remain incomplete. The available Vercel URL is not serving a deployment, and no Production deployment was attempted. See [security review](SECURITY-REVIEW-PR2.md) and the [Supabase test plan](SUPABASE-INTEGRATION-TEST-PLAN.md).
