import { describe, expect, it } from "vitest";
import { validateSchedule } from "./schedule";

describe("Asia/Bangkok schedule validation", () => {
  const now = new Date("2026-10-17T00:00:00.000Z");

  it("converts Bangkok wall-clock time to UTC", () => {
    expect(validateSchedule({
      date: "2026-10-17", startTime: "14:00", endTime: "15:00",
    }, now)).toEqual({
      ok: true,
      startIso: "2026-10-17T07:00:00.000Z",
      endIso: "2026-10-17T08:00:00.000Z",
    });
  });

  it("supports appointments finishing after midnight in Bangkok", () => {
    expect(validateSchedule({
      date: "2026-10-17", startTime: "23:00", endTime: "01:00",
    }, now)).toEqual({
      ok: true,
      startIso: "2026-10-17T16:00:00.000Z",
      endIso: "2026-10-17T18:00:00.000Z",
    });
  });

  it("rejects invalid calendar dates", () => {
    expect(validateSchedule({
      date: "2026-02-30", startTime: "14:00", endTime: "15:00",
    }, now).ok).toBe(false);
  });

  it("rejects non-forward and past ranges", () => {
    expect(validateSchedule({
      date: "2026-10-17", startTime: "14:00", endTime: "14:00",
    }, now).ok).toBe(false);
    expect(validateSchedule({
      date: "2026-10-16", startTime: "14:00", endTime: "15:00",
    }, now).ok).toBe(false);
  });
});
