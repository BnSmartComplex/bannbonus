# Supabase Security Verification — Phase 2

- **Status:** Partially executed against isolated test project `chang24-test` (`qphwxusdpnsrgtarpzhs`) only; Production not accessed.
- **Applied:** `0001_initial.sql`, `0002_rls_performance_hardening.sql`, and pgTAP test extension. Test project was empty before setup.
- **Related:** [Integration test plan](SUPABASE-INTEGRATION-TEST-PLAN.md), [rollback plan](MIGRATION-ROLLBACK-PLAN.md), and [production readiness checklist](PRODUCTION-READINESS-CHECKLIST.md).

## Current database access contract

The starter's intended access surface is deliberately narrow:

| Principal | Booking requests | Direct writes | Equipment photos |
|---|---|---|---|
| `anon` | No access | No access | No access |
| `authenticated` customer | Own requests only | No direct table writes; create through `create_booking_request` RPC | Own object paths only |
| `operator` / `tenant_admin` | Requests in own tenant | No direct table writes; booking confirmation is not implemented | Object access is not granted by the current Storage policies |
| `technician` | No access to the general booking queue in this starter | No access | No access |
| `service_role` | Explicit table/function grants are revoked by this migration | No application RPC grant | Not used by the client or test harness |

RLS and SQL grants are separate controls. The API role must have an object grant before row policies can authorize rows. Conversely, a grant alone must not expose rows when RLS is enabled. Migration `0002` adds explicit deny-all policies to the internal outbox/audit tables, indexes the foreign keys, and wraps `auth.uid()` calls in scalar subqueries for query-level initialization.

## Verification coverage

- `supabase/tests/0001_schema_security.test.sql`: now contains 25 assertions covering schema objects, RLS, grants, tenant constraints, idempotency, RPC privileges/security-definer configuration, private bucket, Storage policies, explicit deny policies, foreign-key indexes, and `auth.uid()` initplan wrappers.
- `supabase/tests/0002_tenant_rls_rpc.test.sql`: positive/negative row visibility, tenant isolation, RPC validation, ambiguous membership, idempotent retry, and single outbox/audit writes.
- `scripts/supabase-api-check.mjs`: pre-provisioned customer/operator/technician credentials and a private Storage fixture, using only the anon key.
- `supabase/verification/0001_security_snapshot.sql`: read-only catalog/configuration output, with no customer rows.

A read-only aggregate check after migration `0002` returned **true for all 25 structural/grant/RLS/index/bucket invariants**. The tenant/RPC pgTAP suite reached its final assertion (`ok 19`); all synthetic fixture counts were zero after rollback. The SQL connector exposed only the final result row, so a complete TAP report was not captured. The API/Auth/Storage harness has not run because no test credentials or Auth fixtures were provisioned.

## Advisor findings

- The only remaining security advisor warning is that `authenticated` can execute the `SECURITY DEFINER` `create_booking_request` RPC. This is intentional: the client must submit a booking without direct table-write privileges. Mitigations include an empty `search_path`, fully-qualified object references, strict server validation, `auth.uid()`, authenticated-only execute grants, no `anon`/`service_role` execute grants, idempotency, and an audit record. Reassess this warning if the RPC contract changes. [Supabase advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- Performance advisors no longer report unindexed foreign keys or auth-initplan warnings. They report the eight new indexes as unused because the test tables are empty; retain them for the declared foreign-key and access patterns, then reassess with real workload evidence before changing them.

## Acceptance criteria

- Anonymous access cannot read a booking, membership, tenant, or private object.
- Customer A and customer B cannot read each other's booking or photo metadata/object.
- Operator/tenant-admin access is restricted to the member's tenant. A technician cannot read the whole queue.
- Authenticated users cannot bypass the RPC with direct table writes. `create_booking_request` is callable only by authenticated users and rejects missing/ambiguous customer membership, invalid category, invalid consent, and foreign-owned photo paths.
- Replaying one idempotency key returns the original booking and does not duplicate the research outbox or audit entry.
- Storage remains private and signed URLs follow owner policy. Public URL paths do not return the object.
- No service-role credential is present in browser code, test templates, or repository history.

These criteria are only partially evidenced; a true structural check does not replace complete TAP output, API/Auth/Storage tests, concurrency tests, or a backup/restore rehearsal.

## Test execution and evidence

For local database tests, use a reviewed local Supabase configuration and run `supabase test db` against the local stack only. For API tests, copy `.env.supabase-test.example` to the ignored `.env.supabase-test`, populate only isolated test values, and run `npm run test:supabase:api`. The script verifies an explicit environment acknowledgement and project-ref/URL match before making a request.

Evidence to attach to the PR after further runs: commit SHA, non-secret environment label/project ref, command, date, exit status, test count, and sanitized failures. Do not attach access tokens, passwords, customer PII, or raw auth/storage responses.

## References

- [Supabase Testing overview](https://supabase.com/docs/guides/local-development/testing/overview).
- [Supabase pgTAP](https://supabase.com/docs/guides/database/extensions/pgtap).
- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).

## 2026-10-16 verification update
Both existing pgTAP suites reran successfully against the empty isolated chang24-test project: **25/25 structural checks and 19/19 RLS/RPC checks**, with every TAP line captured in [the report](verification/2026-10-16-supabase-tap.json). A temporary result table collected assertions without changing their role context. All test fixtures were rolled back; subsequent exact counts for tenants, memberships, bookings, audit/outbox, auth users and equipment photos were zero. No permanent migration was applied. Auth/Storage HTTP end-to-end tests still require isolated identities and preview configuration. The SECURITY DEFINER advisor warning remains as described above.
