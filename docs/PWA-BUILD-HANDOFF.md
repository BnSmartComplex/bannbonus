# Build recovery and PWA foundation
2026-10-15

Based on fix/vercel-hobby-build; preserve GOLD.md and existing business rules.
Supabase JS is pinned to 2.57.4 and npm lockfile regenerated. The previous caret resolved to a version whose auth-js dependency was unavailable.

PWA adds a manifest, SVG icon, production-only service worker registration and a standalone Thai offline document. Only that generic document is cached. No customer, technician, auth, API or dossier data is persisted. No background submission, job acceptance or booking confirmation is implemented. New workers use the browser's normal activation lifecycle.

This is a PWA foundation, not a complete technician offline workflow. PNG/iOS icons, device installation and browser airplane-mode tests remain required. SVG installation support varies by browser.

## Blockers
Codex Cloud failed to query executor configuration capabilities. Testing uses a temporary Vercel Sandbox under the existing bannbonus project instead.
Vercel previously reported no environment variables. Auth/booking integration requires an approved non-production Supabase environment and test accounts; configure credentials via the provider, never paste secrets in chat.
No separate Master Handoff document was supplied in this conversation; existing GOLD.md and repository specifications guide this scoped implementation.

## Verification
Run npm ci, npm audit --audit-level=high, npm run lint, npm run typecheck, npm test and npm run build. Review PR results for actual outcomes.
Service-worker tests cover online responses, offline fallback and exclusion of writes/auth/API/cross-origin requests.
Before release, test install/update/offline on actual mobile browsers and complete authenticated backend/RLS tests.
Rollback: revert this scoped commit; existing business data and migrations are unaffected.
