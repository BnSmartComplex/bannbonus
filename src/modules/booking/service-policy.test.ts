import { describe, expect, it } from "vitest";
import { completedRepairDiscountSatang, dispatchWindow, estimateCallout } from "./service-policy";

describe("Bangkok new-dispatch clock", () => {
  it.each([
    ["2026-10-16T09:59:59.999+07:00", "CLOSED"],
    ["2026-10-16T10:00:00+07:00", "ORDINARY"],
    ["2026-10-16T20:59:59+07:00", "ORDINARY"],
    ["2026-10-16T20:59:59.999+07:00", "ORDINARY"],
    ["2026-10-16T21:00:00+07:00", "NIGHT"],
    ["2026-10-16T23:59:59.999+07:00", "NIGHT"],
    ["2026-10-17T00:00:00+07:00", "NIGHT"],
    ["2026-10-17T01:59:59.999+07:00", "NIGHT"],
    ["2026-10-17T02:00:00+07:00", "CLOSED"],
    ["2026-12-31T17:00:00Z", "NIGHT"],
    ["2026-10-16T14:00:00Z", "NIGHT"],
    ["2026-10-16T21:59:59+07:00", "NIGHT"],
  ])("%s => %s, independent of server timezone", (instant, expected) => {
    expect(dispatchWindow(new Date(instant))).toBe(expected);
  });
  it("uses the same schedule on every day of the week", () => {
    for (let day = 12; day <= 18; day++) {
      expect(dispatchWindow(new Date(`2026-10-${day}T10:00:00+07:00`))).toBe("ORDINARY");
    }
  });
  it("rejects invalid instants", () => {
    expect(() => dispatchWindow(new Date("invalid"))).toThrow("INVALID_DISPATCH_INSTANT");
  });
});
describe("inspection estimate guardrails", () => {
  const daytime = new Date("2026-10-16T20:59:59+07:00");
  it.each([0, 4999, 5000])("quotes 299 for %s verified road metres", (distance) => {
    expect(estimateCallout(daytime, distance)).toEqual({ status: "ESTIMATE", feeBaht: 299 });
  });
  it("quotes 499 at the night boundary", () => {
    expect(estimateCallout(new Date("2026-10-16T21:00:00+07:00"), 5000))
      .toEqual({ status: "ESTIMATE", feeBaht: 499 });
  });
  it.each([5000.01, 5001, 10000])("does not activate unapproved excess-distance pricing: %s", (distance) => {
    expect(estimateCallout(daytime, distance))
      .toEqual({ status: "EXCESS_DISTANCE_REVIEW", feeBaht: null });
  });
  it.each([null, NaN, Infinity, -1])("does not invent missing/invalid road distance: %s", (distance) => {
    expect(estimateCallout(daytime, distance))
      .toEqual({ status: "ROAD_DISTANCE_REQUIRED", feeBaht: null });
  });
  it("never produces a dispatch estimate at 02:00", () => {
    expect(estimateCallout(new Date("2026-10-17T02:00:00+07:00"), 1000))
      .toEqual({ status: "CLOSED", feeBaht: null });
  });
});
describe("completed repair labor discount", () => {
  it.each([
    [20000, true, true, 10000], [5000, true, true, 5000],
    [0, true, true, 0], [50, true, true, 50],
    [20000, false, true, 0], [20000, true, false, 0], [20000, false, false, 0],
  ])("requires approval/completion and caps at labor: %j %j %j", (labor, approved, completed, result) => {
    expect(completedRepairDiscountSatang(labor as number, approved as boolean, completed as boolean)).toBe(result);
  });
  it.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid satang: %s", (labor) => {
    expect(() => completedRepairDiscountSatang(labor, true, true)).toThrow("INVALID_LABOR_AMOUNT");
  });
});
