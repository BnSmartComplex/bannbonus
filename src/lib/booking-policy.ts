export const BOOKING_PRICES = { daytime: 299, nighttime: 499 } as const;

export function bookingPriceBaht(date: Date, timeZone = "Asia/Bangkok"): 299 | 499 {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", hourCycle: "h23",
  }).format(date));
  if (hour >= 10 && hour < 21) return BOOKING_PRICES.daytime;
  if (hour >= 21 || hour < 2) return BOOKING_PRICES.nighttime;
  throw new RangeError("Booking time is outside the confirmed price windows");
}
