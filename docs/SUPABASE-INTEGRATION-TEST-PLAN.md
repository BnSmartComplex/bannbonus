# Supabase Integration Test Plan — Phase 2

- **Status:** PARTIALLY EXECUTED — isolated test schema and transactional tenant/RPC checks were run; API/Auth/Storage and production release gates remain open.
- **Goal:** Verify schema, least privilege, tenant isolation, RPC behavior, Auth, and private Storage before release review.
- **Scope:** Chang24 starter migrations `0001_initial.sql` and `0002_rls_performance_hardening.sql`. This does not implement AI, LINE, appointment approval, or production deployment.

## Environment and safety

The only Supabase project changed in this work is the isolated project **`chang24-test`**, ref `qphwxusdpnsrgtarpzhs`, region `ap-southeast-1`, status `ACTIVE_HEALTHY`. Before applying schema, it had no public tables or migrations, zero Auth users, zero Storage objects, and no `equipment-photos` bucket. No Production project was identified or changed.

Applied to this test project:

1. `chang24_initial_schema_test` — migration version `20261015091329`.
2. `pgtap_test_extension` — migration version `20261015091512`.
3. `chang24_rls_performance_hardening` — migration version `20261015092102`.

Supabase CLI, `psql`, and Docker are unavailable in this workspace. The SQL checks therefore ran through the Supabase management SQL tool. That tool surfaced only the final result row from multi-statement pgTAP scripts, not a complete TAP report. The schema suite reached `ok 22` before hardening; after `0002`, a separate read-only query verified all **25 structural/grant/RLS/index/bucket invariants as true**. The tenant/RPC suite reached its final assertion `ok 19`; follow-up counts confirmed zero synthetic users, tenants, bookings, memberships, outbox entries, audit entries, or Storage objects after rollback. This is partial evidence, not a claim that the complete pgTAP report was captured.

Supabase advisors after hardening report one intentional warning: authenticated users can call the `SECURITY DEFINER` booking RPC. This is required for customer submissions and is mitigated by an empty `search_path`, strict validation, authenticated-only execute grant, no `anon`/`service_role` execute grant, idempotency, and audit. Performance advisors no longer report unindexed foreign keys or auth-initplan warnings; the eight new indexes are reported as unused because the isolated tables have no production workload.

## Fixtures required for remaining API tests

Prepare test-only Auth accounts for customer A/B, operator A/B, tenant administrator A, and technician A, plus a customer with memberships in two tenants. Add one booking fixture per tenant and one private object in `equipment-photos` owned by customer A. Do not use customer data. These accounts, passwords, and object fixtures are not present, so the API harness has not been run.

Use `.env.supabase-test.example` as the variable template. The real `.env.supabase-test` file is ignored by Git. Do not paste credentials into an issue, PR, or chat.

**Current role boundary:** `operator` and `tenant_admin` can read the booking queue within their tenant. `technician` cannot read the `booking_requests` queue under these migrations. Access to assigned jobs requires a separate schema/API/policy and review; do not broaden queue access just to make a test pass. `platform_admin` remains dormant under GOLD and is not provisioned by these migrations.

## Database and RPC suite

The pgTAP scripts in `supabase/tests/` run inside transactions and roll back fixtures:

1. `0001_schema_security.test.sql` checks schema objects, RLS flags, idempotency uniqueness, composite tenant foreign keys, explicit grants, RPC privileges and security-definer configuration, private bucket settings, Storage policy presence, internal deny policies, foreign-key indexes, and `auth.uid()` initplan wrappers.
2. `0002_tenant_rls_rpc.test.sql` seeds disposable users, tenants, and bookings, then checks customer/operator/admin/technician visibility; invalid category rejection; ambiguous membership rejection; foreign-owner photo rejection; idempotent retries; and single outbox/audit side effects.
3. `supabase/verification/0001_security_snapshot.sql` is a read-only configuration snapshot. It returns no booking or customer rows.

The remote test run reached the final assertion of the tenant/RPC suite and fixture counts returned to zero. A full TAP report was not available from the SQL connector. The suite checks sequential idempotent retry behavior; concurrent idempotency remains a release gate.

## API, Auth, and Storage suite

`npm run test:supabase:api` runs `scripts/supabase-api-check.mjs`. The script requires `SUPABASE_TEST_ENVIRONMENT=isolated`, an exact non-production acknowledgement, a project ref matching the URL, and the fixture values. It fails closed before network access if the guard or required values are missing. It also refuses a service-role key.

With fixtures in place, the API checks verify that:

1. Customer A reads booking A but not booking B, and customer B has the inverse result.
2. Operators and tenant admins read only their tenant's booking; technicians cannot read the booking queue.
3. An anonymous client cannot read booking fixtures.
4. Customer A can download and sign a URL for their private object; customer B and anonymous users cannot.
5. The public-object endpoint does not serve the private object.

OTP with `shouldCreateUser: false` still requires a local Auth/Inbucket test: use a reserved test address with no user, verify no Auth user is created, then verify the provisioned test user flow without delivering mail to a real recipient. The API harness does not send OTPs or modify accounts. No API/Auth/Storage test was run because test credentials and provisioned Auth users are absent.

## Run procedure for remaining checks

1. Continue using only `chang24-test` or another explicitly isolated project; never point `SUPABASE_TEST_*` at Production.
2. Provision synthetic Auth users and Storage fixtures through an approved test-only process; do not put passwords or keys in Git.
3. Run `npm run test:supabase:api` with the environment guard enabled.
4. Test concurrent idempotency, Auth OTP/no-auto-create, Storage owner/cross-user/signed-URL access, and backup/restore rehearsal.
5. Record only non-secret environment ref, command, date, exit status, test count, and sanitized failures.

## Production review gate

Production review still requires complete pass/fail evidence for positive and negative API cases, concurrent idempotency, OTP/no-auto-create, Storage owner/cross-tenant/signed URL access, grants/RLS, transaction integrity, and backup/restore rehearsal. The SQL checks above do not authorize Production deployment. Integration status remains **PARTIAL**, not full PASS.

## References

- [Supabase Testing overview](https://supabase.com/docs/guides/local-development/testing/overview) — pgTAP, application-level testing, and CI.
- [Supabase pgTAP](https://supabase.com/docs/guides/database/extensions/pgtap) — schema, RLS, and function assertions.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase CLI](https://supabase.com/docs/reference/cli/introduction).
