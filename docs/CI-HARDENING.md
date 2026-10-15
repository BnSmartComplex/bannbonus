# Phase 1 CI hardening

## Governance
This change is scoped to a feature branch and PR. GOLD.md is unchanged. Booking authorization tests are illustrative domain-policy checks only; they are **not** evidence of transactional booking confirmation or database tenant isolation.

## Findings
- Neither package-lock.json nor pnpm-lock.yaml existed at audit time.
- Previous CI generated a lockfile during the run, defeating reviewed reproducible dependency resolution.
- Previous Vitest command allowed no tests.
- FlatCompat requires @eslint/js recommended/all configuration.
- CI status, production build and typecheck are unverified until actual runner output is inspected.

## Required blocker before merge
Generate and commit a genuine npm package-lock.json using a network-enabled, trusted Node 22/npm 10 environment. Do not fabricate lockfile integrity values. Run npm ci, lint, typecheck, test and build; inspect and resolve failures. CI deliberately fails closed when lockfile is missing.

## Follow-up
Pin action SHAs, enable required PR status checks and branch protection, add security dependency scanning, and verify Node/npm support policy. Do not activate live LINE, dispatch or booking flows without authenticated backend and database concurrency tests.
