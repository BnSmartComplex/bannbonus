const customerOrigin = "https://chang24.vercel.app";

export function customerDestination(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/booking";

  let destination: URL;
  try {
    destination = new URL(raw, customerOrigin);
  } catch {
    return "/booking";
  }
  if (destination.origin !== customerOrigin) return "/booking";
  if (destination.pathname === "/my-bookings") return "/my-bookings";
  if (destination.pathname !== "/booking") return "/booking";

  const query = new URLSearchParams();
  const mode = destination.searchParams.get("mode");
  if (mode === "IMMEDIATE" || mode === "BOOKING") query.set("mode", mode);
  const category = destination.searchParams.get("category");
  if (category && /^[A-Z_]{1,40}$/.test(category)) query.set("category", category);
  return `/booking${query.size ? `?${query}` : ""}`;
}
