// Minimal service worker: cache-first for static assets, network-first for pages with offline fallback.
const CACHE = "melare-v4";
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
  if (/^\/_next\/static\//.test(url.pathname) || /\.(?:woff2|png|svg)$/.test(url.pathname)) {
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

// Admin new-order alerts (Web Push). Payload: { title, body, url } sent by the server.
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: "Melaré", body: e.data?.text() ?? "" }; }
  e.waitUntil(self.registration.showNotification(data.title || "Melaré", {
    body: data.body || "", icon: "/icon-192.png", badge: "/icon-192.png", data: { url: data.url || "/admin" }, tag: data.url,
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/admin", location.origin);
  if (url.origin !== location.origin) return; // only ever open our own pages
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
    const tab = tabs.find((t) => t.url.startsWith(location.origin));
    return tab ? tab.navigate(url.href).then((t) => (t || tab).focus()) : self.clients.openWindow(url.href);
  }));
});
