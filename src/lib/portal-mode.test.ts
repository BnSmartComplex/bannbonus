import { describe, expect, it } from "vitest";
import { portalAllowed } from "./portal-mode";

describe("role-based website split", () => {
  it.each(["/","/login","/staff","/operator/bookings","/technician/jobs"])(
    "staff portal accepts internal route %s", p => expect(portalAllowed("STAFF",p)).toBe(true));
  it.each(["/booking","/my-bookings","/pricing","/api/route-distance","/api/realtime-window"])(
    "staff portal denies customer route %s", p => expect(portalAllowed("STAFF",p)).toBe(false));
  it.each(["/","/login","/booking","/my-bookings","/pricing","/api/route-distance"])(
    "customer portal accepts customer route %s", p => expect(portalAllowed("CUSTOMER",p)).toBe(true));
  it.each(["/staff","/staff/other","/operator/bookings","/technician/jobs"])(
    "customer portal denies internal route %s", p => expect(portalAllowed("CUSTOMER",p)).toBe(false));
});
