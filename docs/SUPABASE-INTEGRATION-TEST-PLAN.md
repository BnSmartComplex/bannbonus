# Supabase Integration Test Plan — Phase 2

- **Status:** BLOCKED — no Supabase test project or credentials have been authorized for this work.
- **Goal:** Verify schema, least privilege, tenant isolation, RPC behavior, Auth, and private Storage before release review.
- **Scope:** Current Chang24 starter and `supabase/migrations/0001_initial.sql`. This does not implement AI, LINE, appointment approval, or production deployment.

## Environment and safety

This review found no Supabase test credentials or confirmed test project in the workspace. Supabase CLI, `psql`, and Docker are also unavailable here. **No Supabase integration test has been run.** The PostgreSQL parser used earlier checks syntax only; it does not prove runtime behavior, grants, RLS, Storage, Auth, or transactions.

Run the database suite only against a local Supabase stack or an explicitly authorized, isolated test project. Never point `SUPABASE_TEST_*` at Production. Do not run `db push` or SQL Editor changes on Production. The API harness uses only the public anon key and pre-provisioned test-user credentials; it does not use a service-role key and does not create or delete bookings or objects.

## Fixtures required in an isolated test environment

Prepare two tenants with customer A/B, operator A/B, tenant administrator A, technician A, and one customer with memberships in two tenants. Add one booking fixture per tenant. Add one private object in `equipment-photos` owned by customer A. Use test-only accounts and synthetic records; do not use customer data.

Use `.env.supabase-test.example` as the variable template. The real `.env.supabase-test` file is ignored by Git. Do not paste credentials into an issue, PR, or chat.

**Current role boundary:** `operator` and `tenant_admin` can read the booking queue within their tenant. `technician` cannot read the `booking_requests` queue under this migration. Access to assigned jobs requires a separate schema/API/policy and review; do not broaden queue access just to make a test pass. `platform_admin` remains dormant under GOLD and is not provisioned by this migration.

## Database and RPC suite

The pgTAP scripts in `supabase/tests/` run inside transactions and roll back fixtures:

1. `0001_schema_security.test.sql` checks schema objects, RLS flags, idempotency uniqueness, composite tenant foreign keys, explicit grants, RPC privileges and security-definer configuration, private bucket settings, and Storage policy presence.
2. `0002_tenant_rls_rpc.test.sql` seeds disposable users, tenants, and bookings, then checks customer/operator/admin/technician visibility; invalid category rejection; ambiguous membership rejection; foreign-owner photo rejection; idempotent retries; and single outbox/audit side effects.
3. `supabase/verification/0001_security_snapshot.sql` is a read-only configuration snapshot. It returns no booking or customer rows.

The SQL suite checks sequential idempotent retry behavior. A concurrent race test remains a release gate; the current workspace cannot start a Postgres/Supabase stack.

## API, Auth, and Storage suite

`npm run test:supabase:api` runs `scripts/supabase-api-check.mjs`. The script requires `SUPABASE_TEST_ENVIRONMENT=isolated`, an exact non-production acknowledgement, a project ref matching the URL, and the fixture values. It fails closed before network access if the guard or required values are missing. It also refuses a service-role key.

With fixtures in place, the API checks verify that:

1. Customer A reads booking A but not booking B, and customer B has the inverse result.
2. Operators and tenant admins read only their tenant's booking; technicians cannot read the booking queue.
3. An anonymous client cannot read booking fixtures.
4. Customer A can download and sign a URL for their private object; customer B and anonymous users cannot.
5. The public-object endpoint does not serve the private object.

OTP with `shouldCreateUser: false` still requires a local Auth/Inbucket test: use a reserved test address with no user, verify no Auth user is created, then verify the provisioned test user flow without delivering mail to a real recipient. The API harness does not send OTPs or modify accounts.

## Run procedure after authorization

1. Confirm the exact non-production project/ref with its owner and verify the Auth allowlist, test fixtures, and Storage ownership.
2. For local Supabase, prepare the Supabase CLI, Docker, and a reviewed `supabase/config.toml`; this repository does not yet have that local config. `supabase start`, `supabase db reset`, and `supabase test db` must target only the local stack.
3. For an approved remote test project, use only that project's credentials and an owner-approved migration process. Record the result without storing secrets or personal data.
4. Create `.env.supabase-test` from the template and run `npm run test:supabase:api`.
5. Reset or clean only local/disposable test data using the rollback plan. The SQL suite rolls back its fixtures and the API harness is read-only apart from authentication sign-in and signed-URL requests.

## Production review gate

Production review requires actual pass/fail evidence for positive and negative cases, concurrent idempotency, OTP/no-auto-create, Storage owner/cross-tenant/signed URL access, grants/RLS, transaction integrity, and backup/restore rehearsal. Until then, integration status is **NOT RUN / BLOCKED**, not PASS.

## References

- [Supabase Testing overview](https://supabase.com/docs/guides/local-development/testing/overview) — pgTAP, application-level testing, and CI.
- [Supabase pgTAP](https://supabase.com/docs/guides/database/extensions/pgtap) — schema, RLS, and function assertions.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase CLI](https://supabase.com/docs/reference/cli/introduction).
