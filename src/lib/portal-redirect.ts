export const customerLoginDestinationKey = "chang24:post-login-destination";

const customerTransferKey = "bannbonus:customer-transfer-at";

export function oauthCallbackUrl(origin: string, staffPortal: boolean): string {
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", staffPortal ? "/" : "/booking");
  return callback.toString();
}

export function redirectCustomerToChang24(): boolean {
  try {
    const previous = Number(window.sessionStorage.getItem(customerTransferKey));
    if (previous && Date.now() - previous < 120_000) return false;
    window.sessionStorage.setItem(customerTransferKey, String(Date.now()));
  } catch {
    // A blocked storage API should not strand a customer on the staff site.
  }
  window.location.replace("https://chang24.vercel.app/login?next=%2Fbooking&auto=1");
  return true;
}
