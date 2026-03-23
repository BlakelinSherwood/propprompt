// PropPrompt Service Worker
const CACHE_NAME = 'propprompt-v1';

// Cache app shell on install
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin or app assets
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip API/function calls — always network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/functions/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for app shell assets
        if (response.ok && (url.origin === self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
