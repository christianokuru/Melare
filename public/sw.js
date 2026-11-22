// Minimal service worker: cache-first for static assets, network-first for pages with offline fallback.
const CACHE = "melare-v2";
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
  const url = new URL(request.url);
  // Never cache API, auth, account, admin or checkout responses.
  if (request.method !== "GET" || url.origin !== location.origin || /^\/(api|account|admin|checkout|cart)/.test(url.pathname)) return;
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (/^\/(_next\/static|images)\//.test(url.pathname) || /\.(?:woff2|png|svg)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then((hit) =>
        hit || fetch(request).then((res) => {
          if (!res.ok) return res;
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
      )
    );
  }
});
