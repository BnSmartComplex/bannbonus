# Migration Rollback Plan — Chang24 Supabase Starter

- **Status:** Prepared before any Supabase migration execution.
- **Migration:** `supabase/migrations/0001_initial.sql`.
- **Current state:** The migration has not been executed against any Supabase project as part of this work.

## Safety rule

Do not apply or roll back this migration in Production. Do not drop tables, delete booking/audit records, or delete the `equipment-photos` bucket as a routine rollback. The bucket may already exist or contain user objects, and the schema has no approved data-retention/deletion workflow.

## Before applying to an isolated test project

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

Prefer discarding and recreating the disposable project only when its owner approves and confirms that it contains no non-test data. Otherwise, stop the test, preserve the database and bucket, and have the project owner choose a controlled recovery. Do not issue ad hoc `DROP TABLE`, `DROP FUNCTION`, bucket deletion, or broad `DELETE` commands.

### Production or data-bearing environment

No automatic rollback is defined or authorized. Stop deployment and writes, preserve logs and backups, identify whether the migration or application code changed, and escalate to the system owner. Choose a forward-compatible corrective migration or a verified restore only after a reviewed incident plan. Reverting application code alone does not reverse schema changes and can break compatibility.

## Application rollback

If a later approved release introduces application changes, roll back to the last known-good commit only after verifying compatibility with the database schema and Auth/Storage configuration. Keep pending requests, audit history, and private objects intact. Any schema rollback must be a separate reviewed migration with explicit data-preservation and restore evidence.

## Recovery evidence required before release

Record the environment/ref (non-secret), backup timestamp, migration SHA, execution result, application SHA, rollback owner, restore procedure, and a successful restore rehearsal. Never store project passwords, service-role keys, access tokens, or customer data in this document or the PR.
