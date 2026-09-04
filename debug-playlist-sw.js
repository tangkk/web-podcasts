const CACHE_NAME = 'web-podcasts-debug-playlist-v1';
const PLAYLIST_PATH = '/web-podcasts/debug-dynamic-playlist.m3u8';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'SET_DEBUG_PLAYLIST' || typeof data.text !== 'string') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const url = new URL(PLAYLIST_PATH, self.location.origin).href;
    await cache.put(url, new Response(data.text, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    }));
    event.ports?.[0]?.postMessage({ok:true, url});
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname !== PLAYLIST_PATH) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(new URL(PLAYLIST_PATH, self.location.origin).href);
    if (response) return response;
    return new Response('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-ENDLIST\n', {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  })());
});
