import { dispatchWindow, SERVICE_POLICY } from "../modules/booking/service-policy";

export type ExtraDistanceRounding = "PRO_RATA" | "CEIL_KILOMETRE";
export type RealtimePriceResult =
  | {
      status: "PRICING_NOT_APPROVED" | "CLOSED";
      requestAt: string;
      distanceMeters: number;
      extraMeters: number;
      baseFeeBaht: null;
      extraFeeBaht: null;
      totalBaht: null;
      rounding: null;
    }
  | {
      status: "QUOTABLE";
      requestAt: string;
      distanceMeters: number;
      extraMeters: number;
      baseFeeBaht: number;
      extraFeeBaht: number;
      totalBaht: number;
      rounding: ExtraDistanceRounding;
    };

/**
 * Quote preview from the actual server instant when the customer presses
 * "เรียกช่าง". No actual payment is authorized by this calculation.
 * No default per-kilometre rate or rounding policy is assumed.
 */
export function realtimeQuote(
  requestReceivedAt: Date,
  distanceMeters: number,
  excessBahtPerKm: number | null,
  rounding: ExtraDistanceRounding | null,
): RealtimePriceResult {
  if (!Number.isFinite(requestReceivedAt.valueOf())
      || !Number.isSafeInteger(distanceMeters) || distanceMeters < 0) {
    throw new Error("INVALID_REALTIME_QUOTE_INPUT");
  }
  const requestAt = requestReceivedAt.toISOString();
  const extraMeters = Math.max(0, distanceMeters - SERVICE_POLICY.includedRoadMeters);
  const window = dispatchWindow(requestReceivedAt);
  if (window === "CLOSED") return {
    status: "CLOSED", requestAt, distanceMeters, extraMeters,
    baseFeeBaht: null, extraFeeBaht: null, totalBaht: null, rounding: null,
  };
  if (extraMeters > 0 && (excessBahtPerKm === null || rounding === null)) return {
    status: "PRICING_NOT_APPROVED", requestAt, distanceMeters, extraMeters,
    baseFeeBaht: null, extraFeeBaht: null, totalBaht: null, rounding: null,
  };
  if (excessBahtPerKm !== null && (!Number.isSafeInteger(excessBahtPerKm)
      || excessBahtPerKm < 0 || excessBahtPerKm > 10000)) {
    throw new Error("INVALID_EXTRA_DISTANCE_RATE");
  }
  if (rounding !== null && rounding !== "PRO_RATA" && rounding !== "CEIL_KILOMETRE") {
    throw new Error("INVALID_EXTRA_DISTANCE_ROUNDING");
  }
  const baseFeeBaht = window === "ORDINARY"
    ? SERVICE_POLICY.ordinaryFeeBaht : SERVICE_POLICY.nightFeeBaht;
  // All computations in satang. PRO_RATA is rounded to the nearest satang;
  // CEIL_KILOMETRE charges a full kilometre for any remainder.
  const satang = extraMeters === 0 ? 0 : rounding === "CEIL_KILOMETRE"
    ? Math.ceil(extraMeters / 1000) * (excessBahtPerKm ?? 0) * 100
    : Math.round(extraMeters * (excessBahtPerKm ?? 0) * 100 / 1000);
  if (!Number.isSafeInteger(satang)) throw new Error("INVALID_EXTRA_DISTANCE_AMOUNT");
  const extraFeeBaht = satang / 100;
  return {
    status: "QUOTABLE", requestAt, distanceMeters, extraMeters,
    baseFeeBaht, extraFeeBaht, totalBaht: baseFeeBaht + extraFeeBaht,
    rounding: rounding ?? "PRO_RATA",
  };
}

/**
 * Configuration is server-only. Both fields must be set from explicitly
 * approved tariffs; otherwise >5km stays unquoted.
 */
export function approvedExtraDistancePolicy(env: Record<string, string | undefined>) {
  const rateRaw = env.CHANG24_APPROVED_EXTRA_BAHT_PER_KM;
  const roundingRaw = env.CHANG24_APPROVED_EXTRA_ROUNDING;
  if (!rateRaw || !roundingRaw) return { rate: null, rounding: null } as const;
  if (!/^(?:0|[1-9]\d{0,4})$/.test(rateRaw)
    || !["PRO_RATA", "CEIL_KILOMETRE"].includes(roundingRaw)) {
    return { rate: null, rounding: null } as const;
  }
  return { rate: Number(rateRaw), rounding: roundingRaw as ExtraDistanceRounding };
}
