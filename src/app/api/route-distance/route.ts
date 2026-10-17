import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { dayNeramitBusiness } from "@/lib/day-neramit-business";
import { previewOfficeDeparture } from "@/lib/office-route";
import { parseOpenRouteServiceGeoJson } from "@/lib/openstreetmap-route";
import { approvedExtraDistancePolicy, realtimeQuote } from "@/lib/realtime-quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Coordinates only: routing must use a confirmed customer pin, not a guessed geocode. */
const destination = z.object({
  latitude: z.number().finite().min(5).max(21),
  longitude: z.number().finite().min(97).max(106),
}).strict();

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  } });
}

/**
 * Owner-verified office pin -> confirmed customer pin, driven along OSM roads.
 * Fail closed if provider unavailable: no guessed route, distance or payment.
 * ORS duration is a normal routing estimate, NOT guaranteed traffic-aware ETA.
 */
export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = destination.safeParse(raw);
  if (!parsed.success) return json({ error: "CUSTOMER_MAP_PIN_REQUIRED" }, 400);

  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) return json({ error: "LOGIN_REQUIRED" }, 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return json({ error: "AUTH_NOT_CONFIGURED" }, 503);
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(bearer);
  if (error || !user) return json({ error: "INVALID_SESSION" }, 401);

  // Routing is a paid/limited shared service. Never expose ORS key in browser.
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) return json({ error: "ROUTE_PROVIDER_NOT_CONFIGURED" }, 503);

  const office = dayNeramitBusiness.officeCoordinates;
  try {
    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/geo+json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        coordinates: [
          [office.longitude, office.latitude],
          [parsed.data.longitude, parsed.data.latitude],
        ],
        preference: "recommended",
        instructions: true,
        language: "en",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return json({ error: "ROUTE_PROVIDER_UNAVAILABLE" }, response.status === 429 ? 429 : 503);
    const route = parseOpenRouteServiceGeoJson(await response.json());
    if (!route) return json({ error: "DRIVING_ROUTE_NOT_FOUND" }, 422);

    const calculatedAt = new Date();
    const estimatedTravel = previewOfficeDeparture(calculatedAt, route.distanceMeters, route.durationSeconds);
    const { rate, rounding } = approvedExtraDistancePolicy();
    const quote = realtimeQuote(calculatedAt, route.distanceMeters, rate, rounding);

    return json({
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      durationMinutes: Math.ceil(route.durationSeconds / 60),
      geometry: route.geometry,
      roadSteps: route.roadSteps,
      provider: "OPENROUTESERVICE_OSM",
      originOfficeAddress: dayNeramitBusiness.officeAddress,
      originOfficeMapUrl: dayNeramitBusiness.officeMapUrl,
      originOfficeCoordinates: office,
      calculatedAt: calculatedAt.toISOString(),
      pricing: quote,
      approvedExcessRateBahtPerKm: rate,
      departureAt: estimatedTravel.departureAt,
      estimatedArrivalAt: estimatedTravel.estimatedArrivalAt,
      notice: "แผนที่และระยะทางขับรถอ้างอิง OpenStreetMap ชื่อซอย/ตำบลขึ้นกับข้อมูลจริง หมู่ที่ต้องให้ลูกค้ายืนยัน เวลาที่คาดว่าจะถึงไม่ใช่ข้อมูลจราจรสด และราคาจริงยึดเวลาที่ระบบรับการกดเรียกช่าง",
    },200);
  } catch {
    return json({ error: "ROUTE_PROVIDER_UNAVAILABLE" },503);
  }
}
