import type { NextConfig } from "next";

const portal = process.env.NEXT_PUBLIC_APP_PORTAL;
if (process.env.VERCEL === "1" && portal !== "CUSTOMER" && portal !== "STAFF") {
  throw new Error("Set NEXT_PUBLIC_APP_PORTAL to CUSTOMER or STAFF before building on Vercel.");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
