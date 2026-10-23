import { describe, expect, it } from "vitest";
import { oauthCallbackUrl } from "./portal-redirect";

describe("OAuth callback destinations", () => {
  it("uses the exact Chang24 callback regardless of the requested booking page", () => {
    expect(oauthCallbackUrl("https://chang24.vercel.app", false))
      .toBe("https://chang24.vercel.app/auth/callback?next=%2Fbooking");
  });

  it("keeps the BannBonus callback on the staff portal", () => {
    expect(oauthCallbackUrl("https://bannbonus.vercel.app", true))
      .toBe("https://bannbonus.vercel.app/auth/callback?next=%2F");
  });
});
