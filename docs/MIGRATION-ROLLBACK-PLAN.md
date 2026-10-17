# Migration Rollback Plan — Chang24 Supabase Starter

- **Status:** Migrations applied only to isolated test project `chang24-test` on 2026-10-15; no Production migration has been run.
- **Project ref:** `qphwxusdpnsrgtarpzhs` (`ap-southeast-1`, `ACTIVE_HEALTHY`). This is a non-secret project identifier.
- **Applied migration history:** `chang24_initial_schema_test` (`20261015091329`), `pgtap_test_extension` (`20261015091512`), and `chang24_rls_performance_hardening` (`20261015092102`).
- **Post-test state:** synthetic Auth, tenant, booking, membership, outbox, audit, and Storage fixture counts all returned to zero. The test schema and private bucket remain in `chang24-test`.

## Safety rule

Do not apply or roll back these migrations in Production. Do not drop tables, delete booking/audit records, or delete the `equipment-photos` bucket as a routine rollback. The bucket may contain user objects in a data-bearing environment, and the schema has no approved data-retention/deletion workflow.

## Before applying to another isolated test project

1. Record the exact project ref and confirm it is non-production with the owner.
2. Confirm the project has no real customer data and no shared workloads.
3. Export a schema/backup snapshot where supported and record the migration commit SHA.
4. Review the migration against the existing schema. `CREATE TABLE IF NOT EXISTS` does not prove that a pre-existing table has the expected shape; inspect drift before applying.
5. Confirm the existing bucket is either absent or exactly matches the expected private settings. The migration intentionally fails closed on a mismatched bucket.
6. Keep app/API deployment separate from schema application. Do not add production secrets or enable automatic rollout.

## Rollback by environment

### Local Supabase stack

The pgTAP files use `BEGIN`/`ROLLBACK` and should not persist their fixture rows. To reset a disposable local stack, use the documented local Supabase reset workflow only after verifying the CLI is targeting the local stack. This reset is destructive to local test data; it must never be run with remote-project flags or against a linked Production project.

### Disposable remote test project

The `chang24-test` project now contains the starter schema, private bucket metadata, test policies/indexes, and pgTAP extension. No automatic destructive rollback was performed. Prefer discarding/recreating the disposable project only when its owner approves and confirms it contains no non-test data. Otherwise preserve the schema and bucket, stop the test, and have the project owner choose a controlled recovery. Do not issue ad hoc `DROP TABLE`, `DROP FUNCTION`, bucket deletion, or broad `DELETE` commands.

### Production or data-bearing environment

No automatic rollback is defined or authorized. Stop deployment and writes, preserve logs and backups, identify whether the migration or application code changed, and escalate to the system owner. Choose a forward-compatible corrective migration or a verified restore only after a reviewed incident plan. Reverting application code alone does not reverse schema changes and can break compatibility.

## Application rollback

If a later approved release introduces application changes, roll back to the last known-good commit only after verifying compatibility with the database schema, Auth, and Storage configuration. Keep pending requests, audit history, and private objects intact. Any schema rollback must be a separate reviewed migration with explicit data-preservation and restore evidence.

## Recovery evidence required before release

Record the environment/ref (non-secret), backup timestamp, migration SHA, execution result, application SHA, rollback owner, restore procedure, and a successful restore rehearsal. Never store project passwords, service-role keys, access tokens, or customer data in this document or the PR.

## Unmerged booking migration numbering

The atomic booking migration is 0003_atomic_booking_approval.sql. It previously reused 0002, which belongs to 0002_rls_performance_hardening.sql and caused fresh Supabase startup to fail on the schema_migrations primary key. This is a filename-only correction to an unmerged migration; no hosted migration history is repaired or reapplied. Any environment that independently applied the earlier booking file needs separate schema/history review and a forward migration before rollout.
