import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import manifest from "../app/manifest";

function worker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const fallback = { offline: true };
  const cache = { match: vi.fn().mockResolvedValue(fallback), put: vi.fn() };
  const fetch = vi.fn().mockResolvedValue({ online: true });
  const caches = { open: vi.fn().mockResolvedValue(cache) };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { location: { origin: "https://example.test" },
      addEventListener: (name: string, fn: (event: unknown) => void) => { handlers[name] = fn; } },
    fetch, caches, URL,
  });
  return { handlers, fetch, cache, fallback };
}
function request(overrides = {}) {
  return { method: "GET", mode: "navigate", url: "https://example.test/staff", ...overrides };
}
describe("PWA privacy boundary", () => {
  it("keeps start URL within scope and names the app", () => {
    expect(manifest()).toMatchObject({ start_url: "/", scope: "/", display: "standalone", lang: "th" });
  });
  it("returns a generic offline page on network failure without storing private HTML", async () => {
    const w = worker();
    w.fetch.mockRejectedValue(new Error("offline"));
    let response: unknown;
    w.handlers.fetch({ request: request(), respondWith: (p: unknown) => { response = p; } });
    expect(await response).toBe(w.fallback);
    expect(w.cache.put).not.toHaveBeenCalled();
  });
  it("uses the live response when online without caching it", async () => {
    const w = worker();
    let response: unknown;
    w.handlers.fetch({ request: request(), respondWith: (p: unknown) => { response = p; } });
    expect(await response).toEqual({ online: true });
    expect(w.cache.put).not.toHaveBeenCalled();
  });
  it.each([
    { method: "POST" }, { mode: "cors" }, { url: "https://db.example.test/private" },
    { url: "https://example.test/auth/callback" },
    { url: "https://example.test/api/bookings" },
    { url: "https://example.test/login?code=secret" },
  ])("leaves writes, API, auth and non-navigation requests untouched: %j", (overrides) => {
    const w = worker();
    const respondWith = vi.fn();
    w.handlers.fetch({ request: request(overrides), respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(w.fetch).not.toHaveBeenCalled();
  });
});
