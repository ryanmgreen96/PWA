const CACHE_NAME = 'pwa-cache-v1';

const FILES_TO_CACHE = [
  '/PWA/',
  '/PWA/index.html',
  '/PWA/scripts.js',
  '/PWA/jquery.min.js',
  '/PWA/manifest.json',
  '/PWA/Icon.png',
  '/PWA/greats.html',
  '/PWA/Moral.html',
  '/PWA/Open.html',
  '/PWA/theLimit.html',
  '/PWA/Centaur.woff2'
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
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
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

self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return;

  evt.respondWith(
    fetch(evt.request)
      .then((networkResponse) => {
        // Optionally cache the new response
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(evt.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // If network fails, use cache
        return caches.match(evt.request);
      })
  );
});
