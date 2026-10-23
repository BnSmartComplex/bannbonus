import { describe, expect, it } from "vitest";
import { customerDestination } from "./customer-destination";

describe("customerDestination", () => {
  it("keeps the selected booking mode and category through Google login", () => {
    expect(customerDestination("/booking?mode=IMMEDIATE&category=AIR_CONDITIONER"))
      .toBe("/booking?mode=IMMEDIATE&category=AIR_CONDITIONER");
  });

  it("keeps booking history as the post-login destination", () => {
    expect(customerDestination("/my-bookings")).toBe("/my-bookings");
  });

  it.each(["https://evil.example/booking", "//evil.example", "/operator/bookings", "/booking?mode=WRONG"])(
    "does not trust an unsupported destination: %s",
    raw => expect(customerDestination(raw)).toBe("/booking"),
  );
});
