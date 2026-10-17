/* global self, caches, fetch, URL */
const CACHE = "bannbonus-offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    const response = await fetch(OFFLINE, { cache: "reload", redirect: "error" });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      throw new Error("Offline page unavailable");
    }
    await cache.put(OFFLINE, response);
  }));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("bannbonus-offline-") && key !== CACHE)
      .map((key) => caches.delete(key)),
  )));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" ||
      url.origin !== self.location.origin || url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/auth/") || url.search) return;
  // Network only: never persist authenticated HTML, API responses or customer data.
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE);
    const fallback = await cache.match(OFFLINE);
    if (!fallback) throw new Error("Offline page not installed");
    return fallback;
  }));
});
