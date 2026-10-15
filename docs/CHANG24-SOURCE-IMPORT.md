# Chang24 source import — review status

## Provenance and scope

Application starter imported from the user-provided `chang24-website-source.zip` into the review branch. It adds a Thai landing page, email OTP sign-in, a booking-request form, private equipment-photo uploads, a customer request list, a read-only staff queue, validation, and a draft Supabase schema/RLS migration. It contains no customer records or real service credentials.

This remains a proposal, not a decision to provision Supabase, Firebase App Hosting, or Vercel. `GOLD.md` remains authoritative. The hosting analysis is recorded as **Proposed** in [ADR-0002](ADR-0002-HOSTING-OPTIONS.md); no production architecture change is authorized by that document. The security review is in [SECURITY-REVIEW-PR2.md](SECURITY-REVIEW-PR2.md).

## Current limitations

- No Supabase project, production environment variables, email provider configuration, Firebase Hosting/App Hosting configuration, or working Vercel deployment is configured by this PR.
- No production signup/onboarding or trusted admin workflow provisions tenants and memberships. Customer OTP does not create accounts automatically; a trusted administrator must provision users.
- Booking requests remain pending team review; there is no approval, scheduling, dispatch, technician availability, quote, payment, or customer confirmation workflow.
- The staff view is read-only. Database RLS is the security boundary; UI routing is not an authorization boundary.
- Photos are private and owner-readable. Staff image access, content inspection, EXIF removal, malware scanning, orphan cleanup, rate limiting, and retention automation are not implemented.
- The research outbox only enqueues work; no worker, OEM/reference-image search, visual comparison, AI diagnosis, BN Tactical runtime, or LINE integration is included.
- No mock operational records or fabricated equipment evidence are included in this PR.
- The SQL migration has not been applied to a Supabase project and has not been integration-tested for cross-tenant/RLS behavior. Review and test it in an isolated project before use.
- Existing public URLs were checked read-only on 2026-10-15: `chang24.vercel.app` returned HTTP 404 `DEPLOYMENT_NOT_FOUND`; `bannbonus.web.app` displayed production/AI claims that were not verified against backend behavior. See ADR-0002 and the security review.

## Validation on the import branch

Final results after the hardening changes are recorded in [SECURITY-REVIEW-PR2.md](SECURITY-REVIEW-PR2.md) and the PR description. Build and unit tests do not substitute for integration tests against a real, isolated Supabase project. The SQL migration has not been executed.

## Phase 2 test assets

Prepared [Supabase integration test plan](SUPABASE-INTEGRATION-TEST-PLAN.md), [security verification guide](SUPABASE-SECURITY-VERIFICATION.md), [migration rollback plan](MIGRATION-ROLLBACK-PLAN.md), [production readiness checklist](PRODUCTION-READINESS-CHECKLIST.md), pgTAP tests under `supabase/tests/`, a read-only SQL snapshot, and a guarded API harness. There is still no authorized Supabase test project or local Supabase runtime in this workspace, so these integration checks are **NOT RUN / BLOCKED**. No migration was applied and no cloud resource was created or changed.

## Release gates

1. Approve hosting, database, authentication, storage, and queue through an ADR without silently changing `GOLD.md`.
2. Run migration and automated RLS/cross-tenant, authorization, upload, abuse-limit, retention, and backup/restore tests only in an isolated project.
3. Provision tenants and memberships through a trusted administrator, never from customer signup.
4. Configure verified email redirect allowlists and environment values without committing secrets; keep service-role keys server-only.
5. Complete privacy notice, purpose, retention, deletion/data-subject handling, and data incident procedures before collecting personal data.
6. Add human approval, audit, and booking/state-machine protections before claiming confirmed appointments.
7. Complete staging checks and explicit production release review before deploying publicly.

## Local setup (after architecture approval)

1. Run `npm ci` in the repository root.
2. Use an isolated, non-production Supabase project only after the ADR is approved; review and apply `supabase/migrations/0001_initial.sql` there.
3. Provision one tenant and customer/operator memberships through a trusted administrator. The starter does not self-provision roles.
4. Copy `.env.example` to `.env.local` and set the public Supabase URL and anon key for that isolated project. Never put a service-role key in client variables or commit secrets.
5. Allowlist the local email-OTP redirect (for example `http://localhost:3000/booking`) in Supabase Auth.
6. Run `npm run dev` and open `http://localhost:3000`.

These steps are not authorization to provision a project, run the migration against production, or deploy this branch.
