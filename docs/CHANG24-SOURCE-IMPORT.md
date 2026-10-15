# Chang24 source import — review status

## Provenance and scope

This application starter was imported from the user-provided `chang24-website-source.zip` into a review branch. It adds a Thai landing page, email OTP sign-in, a booking-request form, private equipment-photo uploads, a customer request list, a read-only staff queue, client-side validation, and a draft Supabase schema/RLS migration. It contains no customer records or service credentials.

The starter is a proposal, not a decision to provision Supabase or Vercel. `GOLD.md` remains authoritative and the hosting/database choice is still open. Do not run the migration against a live project or deploy this branch until the architecture is approved and the release gates below are met.

## Current limitations

- No Supabase project, production environment variables, email provider configuration, or Vercel deployment is configured.
- No production signup/onboarding or trusted admin workflow provisions tenants and memberships.
- Booking requests remain pending team review; there is no approval, scheduling, dispatch, technician availability, quote, payment, or customer confirmation workflow.
- The staff view is read-only. Database RLS is the security boundary; UI routing is not an authorization boundary.
- Photos are private and owner-readable. Staff image access, EXIF removal, malware scanning, orphan cleanup, rate limiting, and retention automation are not implemented.
- The research outbox only enqueues work; no worker, OEM/reference-image search, visual comparison, AI diagnosis, or BN Tactical runtime is included.
- LINE integration is not implemented. No mock operational records or fabricated equipment evidence are included.
- The SQL migration has not been applied to a Supabase project and has not been verified with cross-tenant/RLS integration tests. Review the SQL and test tenant isolation before use.
- Supabase use, production hosting, and any Vercel custom-domain assignment require an approved architecture decision and separate release review.

## Validation recorded for this branch

Commands are run from the repository root. Results are recorded in the pull request after validation on this branch; the ZIP-only baseline was checked separately before import.

## Release gates

1. Approve hosting, database, authentication, storage, and queue through an ADR without changing `GOLD.md` silently.
2. Review the migration and add automated RLS/cross-tenant, authorization, upload, abuse-limit, retention, and backup/restore tests.
3. Provision only after review; create tenant and memberships through a trusted administrator, never from customer signup.
4. Configure verified email redirect allowlists and secret/environment values without committing secrets.
5. Add human approval, audit, and booking/state-machine protections before claiming confirmed appointments.
6. Complete staging checks and explicit production release review before deploying publicly.


## Local setup (after architecture approval)

1. Run `npm ci` in the repository root.
2. Use an isolated, non-production Supabase project only after the ADR is approved; review and apply `supabase/migrations/0001_initial.sql` there.
3. Provision one tenant and customer/operator memberships through a trusted administrator. The starter does not self-provision roles.
4. Copy `.env.example` to `.env.local` and set the public Supabase URL and anon key for that isolated project. Never put a service-role key in client variables or commit secrets.
5. Allowlist the local email-OTP redirect (for example `http://localhost:3000/booking`) in Supabase Auth.
6. Run `npm run dev` and open `http://localhost:3000`.

These steps are not authorization to provision a project or deploy this branch.

## Validation on the import branch

- `npm run lint`: passed with 0 errors or warnings, including with no `.next` output.
- `npm run typecheck`: passed, including with no `.next` output.
- `npm test`: passed, 3 tests.
- `npm run build`: passed on Next.js 15.5.28; routes `/`, `/booking`, `/login`, `/my-bookings`, and `/staff` were generated.
- `npm audit --omit=dev`: 0 production dependency advisories after the PostCSS override.
- Full `npm audit`: 5 high findings remain in the development-only `eslint-config-next` / `@next/eslint-plugin-next` → `fast-glob` / `micromatch` / `braces` dependency tree. npm's offered fix downgrades the Next lint config to 14.2.35; this PR avoids that mismatch and records the outstanding toolchain finding for review.
- SQL execution, live Supabase Auth/Storage/RLS behavior, cross-tenant isolation, and email delivery were not tested because no Supabase project is configured.
