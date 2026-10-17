import { describe, expect, it } from "vitest";
import { approvedExtraDistancePolicy, realtimeQuote } from "./realtime-quote";

const day = new Date("2026-10-18T20:59:59.000+07:00");
const night = new Date("2026-10-18T21:00:00.000+07:00");

describe("Chang24 server click-based distance charges", () => {
  it("daytime 5km includes first 5km with 299 THB even when overage config absent", () => {
    expect(realtimeQuote(day,5000,null,null)).toMatchObject({
      status:"QUOTABLE",distanceMeters:5000,extraMeters:0,
      baseFeeBaht:299,extraFeeBaht:0,totalBaht:299,
    });
  });
  it("night 5km yields 499 THB based on click timestamp", () => {
    expect(realtimeQuote(night,5000,null,null)).toMatchObject({status:"QUOTABLE",totalBaht:499});
  });
  it("shows exact overage, fee, and total at an explicitly configured prorated rate", () => {
    expect(realtimeQuote(day,6200,10,"PRO_RATA")).toMatchObject({
      status:"QUOTABLE",distanceMeters:6200,extraMeters:1200,
      baseFeeBaht:299,extraFeeBaht:12,totalBaht:311,
    });
  });
  it("supports full-km rounding, but only when explicitly approved", () => {
    expect(realtimeQuote(night,6200,10,"CEIL_KILOMETRE")).toMatchObject({
      status:"QUOTABLE",baseFeeBaht:499,extraFeeBaht:20,totalBaht:519,
    });
  });
  it("fails closed >5km without approved rate and rounding", () => {
    expect(realtimeQuote(day,5001,null,null)).toMatchObject({
      status:"PRICING_NOT_APPROVED",extraMeters:1,extraFeeBaht:null,totalBaht:null,
    });
  });
  it("does not accept immediate dispatch after 02:00", () => {
    expect(realtimeQuote(new Date("2026-10-19T02:00:00+07:00"),6500,10,"PRO_RATA"))
      .toMatchObject({status:"CLOSED",totalBaht:null});
  });
  it("does not accept immediate dispatch before 10:00", () => {
    expect(realtimeQuote(new Date("2026-10-19T09:59:59+07:00"),4500,10,"PRO_RATA"))
      .toMatchObject({status:"CLOSED",totalBaht:null});
  });
  it("rejects invalid distance and rate", () => {
    expect(()=>realtimeQuote(day,-1,10,"PRO_RATA")).toThrow("INVALID_REALTIME_QUOTE_INPUT");
    expect(()=>realtimeQuote(day,6200,-1,"PRO_RATA")).toThrow("INVALID_EXTRA_DISTANCE_RATE");
  });
  it("never uses the formerly proposed 10 THB rate as a default", () => {
    expect(approvedExtraDistancePolicy({})).toEqual({rate:null,rounding:null});
  });
});
