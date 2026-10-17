import { describe, expect, it } from "vitest";
import { bookingPriceBaht } from "./booking-policy";

describe("confirmed booking price policy", () => {
  it("charges 299 from 10:00 through 20:59 Bangkok time", () => {
    expect(bookingPriceBaht(new Date("2026-10-17T03:00:00Z"))).toBe(299);
    expect(bookingPriceBaht(new Date("2026-10-17T13:59:59Z"))).toBe(299);
  });
  it("charges 499 from 21:00 through 01:59 Bangkok time", () => {
    expect(bookingPriceBaht(new Date("2026-10-17T14:00:00Z"))).toBe(499);
    expect(bookingPriceBaht(new Date("2026-10-17T18:59:59Z"))).toBe(499);
  });
  it("rejects the unpriced 02:00-09:59 window", () => {
    expect(() => bookingPriceBaht(new Date("2026-10-17T02:00:00Z"))).toThrow();
  });
});
