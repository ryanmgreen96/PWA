const CACHE_NAME = "pwa-cache-v5";

// Core shell + content files loaded by .item clicks.
const APP_FILES = [
  "/",
  "/index.html",
  "/manifest.json",
  "/styles.css",
  "/jquery.min.js",
  "/scripts.js",
  "/scriptMerge.js",
  "/Age.html",
  "/Book.html",
  "/greats.html",
  "/Moral.html",
  "/Open.html",
  "/theLimit.html",
  "/titles.html",
  "/titlesSide.html",
  "/won.html",
  "/WonTitles.html"
];

function scopePathname() {
  return new URL(self.registration.scope).pathname.replace(/\/$/, "");
}

function toScopedUrl(path) {
  const scope = scopePathname();
  if (path === "/") return `${scope}/`;
  return `${scope}${path}`;
}

function normalizeRequestKey(requestUrl) {
  const url = new URL(requestUrl);
  url.hash = "";
  // Ignore query params for same-origin app shell/content requests.
  // Android PWA launches may append query params to start_url.
  if (url.origin === self.location.origin) {
    url.search = "";
  }
  return url.toString();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const urls = APP_FILES.map(toScopedUrl);

      // Cache files individually so one bad/missing file does not kill the whole install.
      await Promise.allSettled(
        urls.map((url) => cache.add(new Request(url, { cache: "reload" })))
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Leave Firestore/API traffic alone.
  if (
    url.origin.includes("firebaseio.com") ||
    url.origin.includes("googleapis.com")
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = normalizeRequestKey(request.url);

      const isNavigationRequest =
        request.mode === "navigate" || request.destination === "document";

      if (isNavigationRequest) {
        const cachedIndex = await cache.match(toScopedUrl("/index.html"));
        if (cachedIndex) return cachedIndex;

        try {
          const network = await fetch(request);
          if (
            network &&
            network.ok &&
            request.url.startsWith(self.location.origin)
          ) {
            await cache.put(cacheKey, network.clone());
          }
          return network;
        } catch (err) {
          const cachedRoot = await cache.match(toScopedUrl("/"));
          if (cachedRoot) return cachedRoot;
          throw err;
        }
      }

      const cached = await cache.match(cacheKey, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const network = await fetch(request);
        if (network && network.ok && request.url.startsWith(self.location.origin)) {
          await cache.put(cacheKey, network.clone());
        }
        return network;
      } catch (err) {
        if (request.destination === "document") {
          const fallback = await cache.match(toScopedUrl("/index.html"));
          if (fallback) return fallback;
        }
        throw err;
      }
    })()
  );
});
