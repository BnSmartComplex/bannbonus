import { estimateCallout, dispatchWindow } from "@/modules/booking/service-policy";

/** A Routes API Duration, e.g. "735s" or "735.5s". Never guess a missing ETA. */
export function parseRouteDurationSeconds(duration: unknown): number | null {
  if (typeof duration !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,9})?s$/.test(duration)) return null;
  const seconds = Number(duration.slice(0, -1));
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 172800 ? seconds : null;
}

/**
 * PREVIEW ONLY: caller must supply the server's time, not the customer's
 * request timestamp or the scheduled on-site appointment start.
 * Actual price must be re-evaluated at the staff-verified office departure.
 */
export function previewOfficeDeparture(departureAt: Date, roadMeters: number, durationSeconds: number) {
  if (!Number.isFinite(departureAt.getTime()) || !Number.isSafeInteger(roadMeters)
    || roadMeters < 0 || !Number.isFinite(durationSeconds) || durationSeconds < 0
    || durationSeconds > 172800) throw new Error("INVALID_OFFICE_ROUTE");
  const quote = estimateCallout(departureAt, roadMeters);
  const eta = new Date(departureAt.getTime() + Math.ceil(durationSeconds * 1000));
  return {
    departureAt: departureAt.toISOString(),
    estimatedArrivalAt: eta.toISOString(),
    durationSeconds,
    departureWindow: dispatchWindow(departureAt),
    estimateStatus: quote.status,
    estimateFeeBaht: quote.feeBaht,
  };
}
