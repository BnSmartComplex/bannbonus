# Supabase Security Verification — Phase 2

- **Status:** Prepared; not executed against a Supabase project.
- **Target:** An isolated test database only. No production project is authorized.
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

RLS and SQL grants are separate controls. The API role must have an object grant before row policies can authorize rows. Conversely, a grant alone must not expose rows when RLS is enabled.

## Verification coverage

- `supabase/tests/0001_schema_security.test.sql`: RLS enabled, explicit table/function privileges, tenant-composite constraints, idempotency constraint, RPC security configuration, and private bucket/policy metadata.
- `supabase/tests/0002_tenant_rls_rpc.test.sql`: positive and negative row visibility, tenant isolation, RPC validation, ambiguous membership, idempotent retry, and single outbox/audit writes.
- `scripts/supabase-api-check.mjs`: pre-provisioned customer/operator/technician credentials and a private Storage fixture, using only the anon key.
- `supabase/verification/0001_security_snapshot.sql`: read-only catalog/configuration output, with no customer rows.

These are test assets, not evidence of a pass. This workspace has no authorized Supabase project and no local Supabase runtime, so none of these tests has been executed here.

## Acceptance criteria

- Anonymous access cannot read a booking, membership, tenant, or private object.
- Customer A and customer B cannot read each other's booking or photo metadata/object.
- Operator/tenant-admin access is restricted to the member's tenant. A technician cannot read the whole queue.
- Authenticated users cannot bypass the RPC with direct table writes. `create_booking_request` is callable only by authenticated users and rejects missing/ambiguous customer membership, invalid category, invalid consent, and foreign-owned photo paths.
- Replaying one idempotency key returns the original booking and does not duplicate the research outbox or audit entry.
- Storage remains private and signed URLs follow owner policy. Public URL paths do not return the object.
- No service-role credential is present in browser code, test templates, or repository history.

## Test execution and evidence

For local database tests, use a reviewed local Supabase configuration and run `supabase test db` against the local stack only. For API tests, copy `.env.supabase-test.example` to the ignored `.env.supabase-test`, populate only isolated test values, and run `npm run test:supabase:api`. The script verifies an explicit environment acknowledgement and project-ref/URL match before making a request.

Evidence to attach to the PR after an authorized run: commit SHA, non-secret environment label/project ref, command, date, exit status, test count, and sanitized failures. Do not attach access tokens, passwords, customer PII, or raw auth/storage responses.

## References

- [Supabase Testing overview](https://supabase.com/docs/guides/local-development/testing/overview).
- [Supabase pgTAP](https://supabase.com/docs/guides/database/extensions/pgtap).
- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).
