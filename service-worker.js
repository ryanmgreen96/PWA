const CACHE_NAME = 'pwa-cache-v1';
const FILES_TO_CACHE = [
  '/',
  '/PWA/index.html',
  '/PWA/jquery.min.js',
  '/PWA/scripts.js',
  '/PWA/style.css',
  '/PWA/greats.html',
  '/PWA/Moral.html',
  '/PWA/Open.html',
  '/PWA/theLimit.html',
  '/PWA/Icon.png',
  '/PWA/manifest.json'
];

// Install event: cache everything listed above
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[ServiceWorker] Caching files');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keyList =>
      Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

// Fetch event: respond with cached content when offline
self.addEventListener('fetch', (evt) => {
  // Only handle GET requests
  if (evt.request.method !== 'GET') return;

  evt.respondWith(
    caches.match(evt.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      // If not cached, fetch from network
      return fetch(evt.request)
        .then(response => {
          // Optionally cache new requests here
          return response;
        })
        .catch(() => {
          // Fallback, e.g. to a cached offline page, if you want
          // return caches.match('offline.html');
        });
    })
  );
});
