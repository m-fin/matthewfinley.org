const VERSION = "mf-20261115-2";
const PRECACHE = [
  "/",
  "/about/",
  "/projects/",
  "/music/",
  "/videos/",
  "/blog/",
  "/blog/new-site/",
  "/blog/what-im-making/",
  "/blog/interests/",
  "/support/",
  "/contact/",
  "/links/",
  "/privacy/",
  "/css/styles.css",
  "/js/site.js",
  "/js/theme-init.js",
  "/js/config-rules.js",
  "/js/support.js",
  "/js/ads.js",
  "/js/analytics.js",
  "/js/projects.js",
  "/js/contact.js",
  "/js/views.js",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/config/site.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then(async (cache) => {
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const home = await cache.match("/");
    if (home && request.mode === "navigate") return home;
    return new Response("You are offline. Pages you already opened can still load when the connection returns.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate" || url.pathname === "/config/site.json" || url.pathname === "/sw.js") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/css/") || url.pathname.startsWith("/js/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/og/")) {
    event.respondWith(cacheFirst(request));
  }
});
