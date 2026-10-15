import { describe, expect, it } from "vitest";
import { booking } from "./validation";

const validBooking = {
  category: "AIR_CONDITIONER",
  fault_description: "เครื่องปรับอากาศไม่เย็นตั้งแต่ช่วงเช้าวันนี้",
  brand: "",
  model_number: "",
  area: "NONTHABURI" as const,
  contact_name: "สมชาย ใจดี",
  contact_phone: "0812345678",
  photo_paths: [],
  consent: true as const,
};

describe("booking validation", () => {
  it("accepts photo fallback when model identification is unavailable", () => {
    expect(booking.safeParse({ ...validBooking, photo_paths: ["user/photo.jpg"] }).success).toBe(true);
  });

  it("rejects missing identification", () => {
    expect(booking.safeParse(validBooking).success).toBe(false);
  });

  it("rejects categories outside the supported intake list", () => {
    expect(booking.safeParse({ ...validBooking, category: "UNREVIEWED_CATEGORY", brand: "Daikin", model_number: "FTKF" }).success).toBe(false);
  });

  it("accepts a complete brand and model", () => {
    expect(
      booking.safeParse({ ...validBooking, brand: "Daikin", model_number: "FTKF" }).success,
    ).toBe(true);
  });
});
