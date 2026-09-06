const ARTWORK_CACHE = 'web-podcasts:artwork-cache:v1';
const RETRY_PARAM = '__artwork_retry';
const inFlight = new Map();

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

function canonicalArtworkRequest(request) {
  try {
    const url = new URL(request.url);
    if (!url.searchParams.has(RETRY_PARAM)) return request;
    url.searchParams.delete(RETRY_PARAM);
    return new Request(url.href, request);
  } catch {
    return request;
  }
}

async function fetchAndCache(request, cache) {
  const key = request.url;
  if (inFlight.has(key)) return inFlight.get(key).then(response => response.clone());

  const promise = (async () => {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone()).catch(() => {});
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
    const canonicalRequest = canonicalArtworkRequest(request);
    const cached = await cache.match(canonicalRequest);
    if (cached) return cached;

    try {
      return await fetchAndCache(canonicalRequest, cache);
    } catch (error) {
      const fallback = await cache.match(canonicalRequest);
      if (fallback) return fallback;
      throw error;
    }
  })());
});
