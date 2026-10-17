import { NextResponse } from "next/server";
import { dispatchWindow, SERVICE_POLICY } from "@/modules/booking/service-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server time is a preview only. The accepted request timestamp comes from PostgreSQL. */
export function GET() {
  const clickedAt = new Date();
  const window = dispatchWindow(clickedAt);
  return NextResponse.json({
    serverTime: clickedAt.toISOString(),
    timeZone: SERVICE_POLICY.timeZone,
    realtimeOpen: window !== "CLOSED",
    window,
    baseFeeBaht: window === "ORDINARY" ? 299 : window === "NIGHT" ? 499 : null,
    includedRoadMeters: SERVICE_POLICY.includedRoadMeters,
    notice: "ค่าบริการจริงของงานเรียลไทม์ใช้เวลารับการกดเรียกช่างที่เซิร์ฟเวอร์ฐานข้อมูล ไม่ใช่เวลาจากโทรศัพท์หรือเวลาช่างออกเดินทาง",
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
