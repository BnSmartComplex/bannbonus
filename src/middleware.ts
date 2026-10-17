import { NextResponse, type NextRequest } from "next/server";
import { portalAllowed, portalMode } from "./lib/portal-mode";

export function middleware(request: NextRequest) {
  const mode = portalMode();
  const pathname = request.nextUrl.pathname;
  if (portalAllowed(mode, pathname)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const destination = request.nextUrl.clone();
  destination.pathname = "/";
  destination.search = "";
  return NextResponse.redirect(destination, 307);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|images/).*)"],
};
