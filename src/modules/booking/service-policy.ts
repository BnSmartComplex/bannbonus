/**
 * Owner-confirmed policy, 2026-10-16 (latest instruction supersedes 21:00).
 * Pure reference calculations only; no booking, assignment or billing writes.
 * A future server command must load tenant policy and verified road routing from
 * trusted sources, then persist the disclosed fee and customer approval.
 */
export const SERVICE_POLICY = {
  version: "2026-10-16-22h",
  timeZone: "Asia/Bangkok",
  dispatchHours: "10:00–02:00",
  ordinaryHours: "10:00–21:59",
  nightHours: "22:00–01:59",
  includedRoadMeters: 5_000,
  ordinaryFeeBaht: 299,
  nightFeeBaht: 499,
  completedRepairLaborDiscountBaht: 100,
  extraDistance: { status: "PENDING_OWNER_APPROVAL", proposedBahtPerKm: 10 },
} as const;

export type DispatchWindow = "ORDINARY" | "NIGHT" | "CLOSED";

const bangkokClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: SERVICE_POLICY.timeZone, hour: "2-digit", hourCycle: "h23",
});

/** Only NEW immediate dispatch is subject to this clock, never existing jobs or free requests. */
export function dispatchWindow(instant: Date): DispatchWindow {
  if (!Number.isFinite(instant.getTime())) throw new Error("INVALID_DISPATCH_INSTANT");
  const hour = Number(bangkokClock.format(instant));
  if (hour >= 10 && hour < 22) return "ORDINARY";
  if (hour >= 22 || hour < 2) return "NIGHT";
  return "CLOSED";
}

type CalloutEstimate =
  | { status: "CLOSED" | "ROAD_DISTANCE_REQUIRED" | "EXCESS_DISTANCE_REVIEW"; feeBaht: null }
  | { status: "ESTIMATE"; feeBaht: number };

/**
 * Distance must be a verified road route from the assigned contractor's base,
 * not customer input or straight-line distance. null means not yet verified.
 * Never round an excess distance into the included range. This is NOT a quote,
 * permission to dispatch, or authorization to collect money.
 */
export function estimateCallout(
  confirmedDispatchAt: Date, verifiedRoadDistanceMeters: number | null,
): CalloutEstimate {
  const window = dispatchWindow(confirmedDispatchAt);
  if (window === "CLOSED") return { status: "CLOSED", feeBaht: null };
  if (verifiedRoadDistanceMeters === null ||
      !Number.isFinite(verifiedRoadDistanceMeters) || verifiedRoadDistanceMeters < 0) {
    return { status: "ROAD_DISTANCE_REQUIRED", feeBaht: null };
  }
  if (verifiedRoadDistanceMeters > SERVICE_POLICY.includedRoadMeters) {
    return { status: "EXCESS_DISTANCE_REVIEW", feeBaht: null };
  }
  return { status: "ESTIMATE", feeBaht: window === "ORDINARY"
    ? SERVICE_POLICY.ordinaryFeeBaht : SERVICE_POLICY.nightFeeBaht };
}

/** Integer satang avoids floating-point currency errors; discount applies only to labor. */
export function completedRepairDiscountSatang(
  laborSatang: number, customerApprovedRepair: boolean, jobCompleted: boolean,
): number {
  if (!Number.isSafeInteger(laborSatang) || laborSatang < 0) {
    throw new Error("INVALID_LABOR_AMOUNT");
  }
  return customerApprovedRepair && jobCompleted
    ? Math.min(laborSatang, SERVICE_POLICY.completedRepairLaborDiscountBaht * 100) : 0;
}
