import { describe, expect, it } from "vitest";
import { BOOKING_REQUEST_STATUS, canConfirmBooking } from "./booking-policy";

describe("booking approval policy", () => {
  const actor = { authenticated: true, tenantId: "tenant-a", roles: ["operator"] };
  it("starts requests pending human review", () => {
    expect(BOOKING_REQUEST_STATUS).toBe("PENDING_TEAM_REVIEW");
  });
  it("allows an authenticated same-tenant operator", () => {
    expect(canConfirmBooking(actor, "tenant-a")).toBe(true);
  });
  it("rejects cross-tenant confirmation", () => {
    expect(canConfirmBooking(actor, "tenant-b")).toBe(false);
  });
  it("rejects customers and unauthenticated actors", () => {
    expect(canConfirmBooking({ ...actor, roles: ["customer"] }, "tenant-a")).toBe(false);
    expect(canConfirmBooking({ ...actor, authenticated: false }, "tenant-a")).toBe(false);
  });
});
