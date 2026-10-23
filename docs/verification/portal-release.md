# Customer and staff deployment verification

Both projects must build the reviewed commit containing `src/middleware.ts`
and `src/lib/portal-mode.ts`. Set `NEXT_PUBLIC_APP_PORTAL=CUSTOMER` on chang24
and `NEXT_PUBLIC_APP_PORTAL=STAFF` on bannbonus before building. Vercel builds
reject missing or invalid portal modes. Changing an environment variable
does not update an existing deployment; rebuild the intended project.

Run `npm run verify:portals` to verify public production navigation without
logging in or creating records. For previews, set `CUSTOMER_PORTAL_URL` and
`STAFF_PORTAL_URL` to their respective preview origins. Protected previews
need a separately authorized access workflow; do not disable protection.

The check rejects customer pages that link to staff routes, verifies blocked
routes redirect to the same site's root, checks staff-only metadata/navigation,
and checks that customer APIs are unavailable on the staff portal.

This is not an authentication or RLS test. Before release, use authorized test
accounts to verify customer request creation, operator approval, technician
visibility and customer status tracking against the same test backend/tenant.
Never substitute that test backend for production.

For rollback, restore the previous deployment on the affected project; these
changes do not modify the database or booking records.
