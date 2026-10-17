/**
 * Owner-confirmed policy, 2026-10-17 (supersedes PR #6's 22:00 boundary).
 * Pure reference calculations only; no booking, assignment or billing writes.
 * Local Chang24 owner update: office -> customer, not technician base -> customer.
 * Only the actual staff-verified office departure timestamp establishes the tariff.
 * A future server command must recheck verified road routing and persist the
 * disclosed fee, explicit customer approval and actual office departure.
 */
export const SERVICE_POLICY = {
  version: "2026-10-17-21h",
  timeZone: "Asia/Bangkok",
  dispatchHours: "10:00–02:00",
  ordinaryHours: "10:00–20:59",
  nightHours: "21:00–01:59",
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
  if (hour >= 10 && hour < 21) return "ORDINARY";
  if (hour >= 21 || hour < 2) return "NIGHT";
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
  actualOfficeDepartureAt: Date, verifiedRoadDistanceMeters: number | null,
): CalloutEstimate {
  const window = dispatchWindow(actualOfficeDepartureAt);
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
