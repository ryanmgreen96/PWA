const CACHE_NAME = "pwa-cache-v9";

// Core shell + content files loaded by .item clicks.
const APP_FILES = [
  "/",
  "/index.html",
  "/manifest.json",
  "/styles.css",
  "/jquery.min.js",
  "/scripts.js",
  "/scriptMerge.js",
  "/service-worker.js",
  "/Age.html",
  "/Book.html",
  "/greats.html",
  "/Moral.html",
  "/Open.html",
  "/theLimit.html",
  "/titles.html",
  "/titlesSide.html",
  "/won.html",
  "/won2.html",
  "/WonTitles.html",
  "/writing.html"
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

      // Cache files individually, but do not activate if any required file failed.
      // A partial cache can break offline item text loads.
      const results = await Promise.allSettled(
        urls.map((url) => cache.add(new Request(url)))
      );

      const failedUrls = results
        .map((result, index) => ({ result, url: urls[index] }))
        .filter((entry) => entry.result.status === "rejected")
        .map((entry) => entry.url);

      if (failedUrls.length > 0) {
        await caches.delete(CACHE_NAME);
        throw new Error(
          `Service worker install aborted. Failed to cache: ${failedUrls.join(", ")}`
        );
      }

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
      const isSameOrigin = url.origin === self.location.origin;

      if (isNavigationRequest) {
        try {
          // Network-first so an online reload picks up fresh content.
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
          const cachedNav = await cache.match(cacheKey, { ignoreSearch: true });
          if (cachedNav) return cachedNav;

          const cachedIndex = await cache.match(toScopedUrl("/index.html"));
          if (cachedIndex) return cachedIndex;

          const cachedRoot = await cache.match(toScopedUrl("/"));
          if (cachedRoot) return cachedRoot;
          throw err;
        }
      }

      // For same-origin app assets, prefer network so reload updates immediately.
      if (isSameOrigin) {
        try {
          const network = await fetch(request);
          if (network && network.ok) {
            await cache.put(cacheKey, network.clone());
          }
          return network;
        } catch (err) {
          const cached = await cache.match(cacheKey, { ignoreSearch: true });
          if (cached) return cached;
          throw err;
        }
      }

      // For cross-origin GET requests, use cache fallback but do not force-cache failures.
      const cached = await cache.match(cacheKey, { ignoreSearch: true });
      if (cached) return cached;
      return fetch(request);
    })()
  );
});
