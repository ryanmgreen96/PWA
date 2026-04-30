const CACHE_NAME = 'pwa-cache-v2';

// List of files to cache
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/scripts.js',
  '/jquery.min.js',
  '/manifest.json',
  '/styles.css',
  '/greats.html',
  '/Moral.html',
  '/Open.html',
  '/theLimit.html',
  '/Age.html',
  '/Book.html',
  '/IndexQ.html',
  '/titles.html',
  '/titlesSide.html'
];

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching files');
        return cache.addAll(FILES_TO_CACHE);
      })
      .catch((err) => console.error('[ServiceWorker] Cache addAll failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return;

  evt.respondWith(
    caches.match(evt.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(evt.request)
          .then((networkResponse) => {
            // Optionally cache new requests
            if (networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(evt.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback for offline
            if (evt.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});
//       .then((cache) => {
//         console.log('[ServiceWorker] Caching files');
//         return cache.addAll(FILES_TO_CACHE);
//       })
//       .catch((err) => console.error('[ServiceWorker] Cache addAll failed:', err))
//   );
// });

// self.addEventListener('activate', (event) => {
//   console.log('[ServiceWorker] Activate');
//   event.waitUntil(
//     caches.keys().then((keyList) =>
//       Promise.all(
//         keyList.map((key) => {
//           if (key !== CACHE_NAME) {
//             return caches.delete(key);
//           }
//         })
//       )
//     )
//   );
//   return self.clients.claim();
// });

// self.addEventListener('fetch', (evt) => {
//   if (evt.request.method !== 'GET') return;

//   evt.respondWith(
//     fetch(evt.request)
//       .then((networkResponse) => {
//         // Optionally cache the new response
//         return caches.open(CACHE_NAME).then(cache => {
//           cache.put(evt.request, networkResponse.clone());
//           return networkResponse;
//         });
//       })
//       .catch(() => {
//         // If network fails, use cache
//         return caches.match(evt.request);
//       })
//   );
// });



const CACHE_NAME = "pwa-cache-v3";

const FILES_TO_CACHE = [
  "/PWA/",
  "/PWA/index.html",
  "/PWA/Age.html",
  "/PWA/Book.html",
  "/PWA/greats.html",
  "/PWA/IndexQ.html",
  "/PWA/Moral.html",
  "/PWA/Open.html",
  "/PWA/theLimit.html",
  "/PWA/titles.html",
  "/PWA/titlesSide.html",
  "/PWA/scripts.js",
  "/PWA/scriptMerge.js",
  "/PWA/jquery.min.js",
  "/PWA/manifest.json",
  "/PWA/Icon.png",
  "/PWA/Centaur.woff2",
  "/PWA/styles.css"
];

self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Install");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[ServiceWorker] Caching files");
        return cache.addAll(FILES_TO_CACHE);
      })
      .catch((err) =>
        console.error("[ServiceWorker] Cache addAll failed:", err)
      )
  );
});

self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activate");
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  return self.clients.claim();
});

self.addEventListener("fetch", (evt) => {
  if (evt.request.method !== "GET") return;

  const url = new URL(evt.request.url);

  // 🚫 Don’t cache Firebase requests
  if (
    url.origin.includes("firebaseio.com") ||
    url.origin.includes("googleapis.com")
  ) {
    return;
  }

  evt.respondWith(
    caches.match(evt.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(evt.request).then((networkResponse) => {
          // Update cache in background
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(evt.request, networkResponse.clone());
          });
          return networkResponse;
        })
      );
    })
  );
});
