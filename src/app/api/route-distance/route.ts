import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { dayNeramitBusiness } from "@/lib/day-neramit-business";
import { estimateCallout } from "@/modules/booking/service-policy";

export const runtime = "nodejs";

const coordinate = z.object({
  latitude: z.number().finite().min(5).max(21),
  longitude: z.number().finite().min(97).max(106),
});

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Server-only driving distance preview. Never bills a customer.
 * This endpoint requires an actual Supabase Auth session and a configured
 * Google Routes API key. Exact map base can be overridden by VERIFIED place ID.
 */
export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = coordinate.safeParse(raw);
  if (!parsed.success) return json({ error: "INVALID_CUSTOMER_LOCATION" }, 400);

  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) return json({ error: "LOGIN_REQUIRED" }, 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return json({ error: "AUTH_NOT_CONFIGURED" }, 503);
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(bearer);
  if (error || !user) return json({ error: "INVALID_SESSION" }, 401);

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) return json({ error: "ROUTE_PROVIDER_NOT_CONFIGURED" }, 503);

  const origin = process.env.DAY_NERAMIT_VERIFIED_PLACE_ID
    ? { placeId: process.env.DAY_NERAMIT_VERIFIED_PLACE_ID }
    : { address: `${dayNeramitBusiness.officeAddress}, ประเทศไทย` };
  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin,
        destination: { location: { latLng: parsed.data } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        units: "METRIC",
        languageCode: "th",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return json({ error: "ROUTE_PROVIDER_UNAVAILABLE" }, 503);
    const result = await response.json() as { routes?: Array<{ distanceMeters?: number; duration?: string }> };
    const route = result.routes?.[0];
    if (!route || !Number.isSafeInteger(route.distanceMeters) || (route.distanceMeters ?? -1) < 0) {
      return json({ error: "DRIVING_ROUTE_NOT_FOUND" }, 422);
    }
    const distanceMeters = route.distanceMeters!;
    const estimate = estimateCallout(new Date(), distanceMeters);
    return json({
      distanceMeters,
      duration: route.duration ?? null,
      provider: "GOOGLE_ROUTES",
      calculatedAt: new Date().toISOString(),
      origin: "DAY_NERAMIT_OFFICE",
      estimateStatus: estimate.status,
      estimateFeeBaht: estimate.feeBaht,
      notice: "ระยะทางเบื้องต้นจากสำนักงาน ยังไม่ใช่ราคาที่ตกลงหรืออนุมัติการออกเดินทาง ต้องตรวจสอบฐานของช่างที่จะรับงาน",
    }, 200);
  } catch {
    return json({ error: "ROUTE_PROVIDER_UNAVAILABLE" }, 503);
  }
}
