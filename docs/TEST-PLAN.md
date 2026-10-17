undefined
### Disposable local HTTP integration gate

- Workflow: .github/workflows/supabase-integration.yml; harness: scripts/local-supabase-integration.mjs.
- Each runner starts real local Supabase Postgres/Auth/REST/Storage using CLI 2.75.0, applies repository migrations and runs the pgTAP suite before HTTP tests. No hosted project credentials or billing are used.
- The harness refuses non-loopback API/database hosts and requires SUPABASE_LOCAL_TEST_CONFIRM=DISPOSABLE_LOCAL_STACK. Local status keys stay in a private runner-temporary file and are never uploaded.
- Tests cover five password sign-ins, bad-password denial, private PNG upload/download, cross-user/anonymous read denial, cross-user overwrite/path denial, HTTP RLS/directory access, technician transitions and cancellation reconciliation.
- Five exact approval races begin with fresh pending bookings and assert one returned appointment id, one row, one audit event and NOT_CHARGED. Three competing-booking races assert one winner and one pending loser for one technician slot.
- Auth uses a genuinely issued 60-second access token: wait until expiry, assert Auth/REST denial, refresh successfully, sign out and assert the refresh token cannot be reused.
- Cleanup always removes local containers/volumes. Hosted migrations, Production and Payment remain unchanged.
- Workflow execution evidence is recorded in PR #8 only after the actual run completes; adding a harness is not a passing test result.
