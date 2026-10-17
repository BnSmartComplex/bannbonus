/** Per-Vercel-project split: STAFF => bannbonus, CUSTOMER => chang24. */
export type PortalMode = "STAFF" | "CUSTOMER";

export function portalMode(): PortalMode {
  return process.env.NEXT_PUBLIC_APP_PORTAL === "STAFF" ? "STAFF" : "CUSTOMER";
}

/** Page and API isolation, independent of UI links; sensitive DB rights still require RLS. */
export function portalAllowed(mode: PortalMode, pathname: string): boolean {
  if (mode === "STAFF") {
    return !(/^\/(booking|my-bookings|pricing)(?:\/|$)/.test(pathname)
      || /^\/api\/(route-distance|realtime-window)(?:\/|$)/.test(pathname));
  }
  return !/^\/(staff|operator|technician)(?:\/|$)/.test(pathname);
}
