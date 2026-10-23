import { describe, expect, it } from "vitest";
import { parseReverseGeocode } from "./reverse-geocode";

describe("parseReverseGeocode", () => {
  it("returns the provider label without inventing house numbers", () => {
    expect(parseReverseGeocode({ features: [{ properties: { layer: "address", label: "67/113 ถ. 3086, บางแม่นาง, บางใหญ่, นนทบุรี" } }] }))
      .toEqual({ address: "67/113 ถ. 3086, บางแม่นาง, บางใหญ่, นนทบุรี", level: "STREET", source: "OPENROUTESERVICE_OSM" });
  });

  it.each([null, {}, { features: [] }, { features: [{ properties: { label: "" } }] }])(
    "does not present a missing address as a match", value => {
      expect(parseReverseGeocode(value)).toBeNull();
    },
  );

  it("marks broad map matches as area-level only", () => {
    expect(parseReverseGeocode({ features: [{ properties: { layer: "locality", label: "บางใหญ่, นนทบุรี" } }] })?.level).toBe("AREA");
  });
});
