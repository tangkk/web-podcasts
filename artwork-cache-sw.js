const ARTWORK_CACHE = 'web-podcasts:artwork-cache:v1';
const inFlight = new Map();

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

async function fetchAndCache(request, cache) {
  const key = request.url;
  if (inFlight.has(key)) return inFlight.get(key).then(response => response.clone());

  const promise = (async () => {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      await cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.destination !== 'image') return;

  event.respondWith((async () => {
    const cache = await caches.open(ARTWORK_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      return await fetchAndCache(request, cache);
    } catch (error) {
      const fallback = await cache.match(request);
      if (fallback) return fallback;
      throw error;
    }
  })());
});
