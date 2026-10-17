import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { dayNeramitBusiness } from "@/lib/day-neramit-business";
import { parseRouteDurationSeconds, previewOfficeDeparture } from "@/lib/office-route";

export const runtime = "nodejs";

/** Customer is never allowed to specify the origin, fee or departure timestamp. */
const destination = z.union([
  z.object({
    latitude: z.number().finite().min(5).max(21),
    longitude: z.number().finite().min(97).max(106),
  }).strict(),
  z.object({
    address: z.string().trim().min(15).max(600),
    district: z.enum(["BANG_YAI", "BANG_BUA_THONG"]),
  }).strict(),
]);

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Office -> customer driving route preview, authenticated and server-only.
 * Google Routes key must be provisioned with project-level usage limits.
 * Travel time assumes departure from office NOW; quote pricing is handled
 * separately using server-received realtime request time. No billing writes.
 */
export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = destination.safeParse(raw);
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
  const end = "latitude" in parsed.data
    ? { location: { latLng: { latitude: parsed.data.latitude, longitude: parsed.data.longitude } } }
    : { address: `${parsed.data.address}, ${parsed.data.district === "BANG_YAI" ? "อำเภอบางใหญ่" : "อำเภอบางบัวทอง"}, จังหวัดนนทบุรี ประเทศไทย` };
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
        destination: end,
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
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
    const seconds = parseRouteDurationSeconds(route.duration);
    if (seconds === null) return json({ error: "DRIVING_ETA_NOT_AVAILABLE" }, 422);
    const departureNow = new Date();
    const preview = previewOfficeDeparture(departureNow, route.distanceMeters!, seconds);
    return json({
      distanceMeters: route.distanceMeters,
      durationSeconds: seconds,
      durationMinutes: Math.ceil(seconds / 60),
      originOfficeAddress: dayNeramitBusiness.officeAddress,
      originOfficeMapUrl: dayNeramitBusiness.officeMapUrl,
      provider: "GOOGLE_ROUTES",
      calculatedAt: departureNow.toISOString(),
      departureAt: preview.departureAt,
      estimatedArrivalAt: preview.estimatedArrivalAt,
      notice: "ระยะทางและเวลาขับรถจากสำนักงานถึงลูกค้าเป็นการประมาณการ ราคาเรียลไทม์ยึดเวลาที่ระบบรับการกดเรียกช่าง และต้องยืนยันค่าเดินทางก่อนออกช่าง",
    }, 200);
  } catch {
    return json({ error: "ROUTE_PROVIDER_UNAVAILABLE" }, 503);
  }
}
