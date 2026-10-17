import { describe, expect, it } from "vitest";
import { parseRouteDurationSeconds, previewOfficeDeparture } from "./office-route";

describe("office to customer driving route", () => {
  it.each([["734s",734],["74.5s",74.5],["0s",0],["172800s",172800]])("parses provider duration %s", (raw,expected) => {
    expect(parseRouteDurationSeconds(raw)).toBe(expected);
  });
  it.each(["", "soon", "NaNs", "-3s", "123456789s", "1.2222222222s", null, 7])("rejects invalid provider duration", value => {
    expect(parseRouteDurationSeconds(value)).toBeNull();
  });
  it("calculates ETA from office departure and does not use arrival time for day/night pricing", () => {
    const result=previewOfficeDeparture(new Date("2026-10-18T20:59:59+07:00"),5000,181);
    expect(result.estimatedArrivalAt).toBe("2026-10-18T14:03:00.000Z");
  });
  it("night rate applies at 21:00 departure, even if the customer books the prior afternoon", () => {
    const result=previewOfficeDeparture(new Date("2026-10-18T21:00:00+07:00"),5000,1200);
  });
  it("travel ETA remains available at 02:00 without pretending immediate dispatch is open", () => {
    const trip=previewOfficeDeparture(new Date("2026-10-19T02:00:00+07:00"),5000,60);
    expect(trip.estimatedArrivalAt).toBe("2026-10-18T19:01:00.000Z");
    expect(trip).not.toHaveProperty("estimateFeeBaht");
  });
  it("rejects nonsensical road distance and duration", () => {
    expect(()=>previewOfficeDeparture(new Date(),-1,45)).toThrow("INVALID_OFFICE_ROUTE");
    expect(()=>previewOfficeDeparture(new Date(),1000,Number.NaN)).toThrow("INVALID_OFFICE_ROUTE");
  });
});
