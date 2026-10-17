# Integration and security test gate

The Supabase test harness is credential-gated. It must use an isolated project and pre-provisioned test accounts; empty environment variables or fixtures are not evidence of a live integration.

Required checks:
- Auth: customer/operator/technician sign-in and session expiry.
- Storage: private bucket upload/read and cross-user denial.
- RLS: customer and staff cannot read another tenant.
- Approval: operator role and tenant membership are checked in the backend.
- Concurrency: two approvals for one booking and overlapping technician slots; exactly one appointment is retained.
- Price boundaries: 10:00/20:59 = 299 and 21:00/01:59 = 499 Bangkok time.
- Run with SUPABASE_TEST_CONFIRM=I_HAVE_VERIFIED_NON_PRODUCTION and all required test credentials populated. Never use production credentials or enable billing.
