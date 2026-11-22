// Minimal service worker: cache-first for static assets, network-first for pages with offline fallback.
const CACHE = "melare-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/logo.svg", "/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (/\.(?:js|css|woff2|png|svg|webp|avif|jpg)$/.test(new URL(request.url).pathname)) {
    e.respondWith(
      caches.match(request).then((hit) =>
        hit || fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
      )
    );
  }
});
