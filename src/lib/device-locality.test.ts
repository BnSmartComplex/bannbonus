import { describe, expect, it } from "vitest";
import { parseDeviceLocality } from "./device-locality";

const point = { latitude: 13.869212, longitude: 100.411022 };

describe("parseDeviceLocality", () => {
  it("shows only named area fields, without inventing a street address", () => {
    expect(parseDeviceLocality({ ...point, countryCode: "TH", locality: "บางแม่นาง", city: "บางใหญ่", principalSubdivision: "นนทบุรี" }, point))
      .toEqual({ area: "บางแม่นาง, บางใหญ่, นนทบุรี" });
  });

  it("rejects IP fallback, another country, and empty results", () => {
    expect(parseDeviceLocality({ countryCode: "TH", locality: "บางแม่นาง" }, point)).toBeNull();
    expect(parseDeviceLocality({ ...point, countryCode: "US", city: "New York" }, point)).toBeNull();
    expect(parseDeviceLocality({ ...point, countryCode: "TH" }, point)).toBeNull();
    expect(parseDeviceLocality({ ...point, longitude: 100.8, countryCode: "TH", city: "บางใหญ่" }, point)).toBeNull();
  });
});
