(() => {
  const CACHE_KEY = 'web-podcasts:episodes-cache:v2';
  const META_KEY = 'web-podcasts:episodes-cache-meta:v2';
  const TARGET_URL = new URL('./episodes.json', location.href).href;
  const nativeFetch = window.fetch.bind(window);

  function readCache() {
    try {
      const value = localStorage.getItem(CACHE_KEY);
      if (!value) return null;
      const parsed = JSON.parse(value);
      return parsed && Array.isArray(parsed.shows) ? value : null;
    } catch {
      return null;
    }
  }

  function saveCache(text) {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.shows)) return;
      localStorage.setItem(CACHE_KEY, text);
      localStorage.setItem(META_KEY, JSON.stringify({
        updatedAt: Date.now(),
        generatedAt: parsed.generatedAt || null,
        shows: parsed.shows.length,
        episodes: parsed.episodeCount || null
      }));
    } catch {
      // Storage can be unavailable or full; network loading should still work normally.
    }
  }

  function refreshInBackground(input, init) {
    nativeFetch(input, { ...init, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return;
        saveCache(await response.clone().text());
      })
      .catch(() => {});
  }

  window.fetch = async function cachedCatalogFetch(input, init = {}) {
    const rawUrl = typeof input === 'string' || input instanceof URL ? input : input?.url;
    let url;
    try { url = new URL(rawUrl, location.href).href; } catch { return nativeFetch(input, init); }
    if (url !== TARGET_URL) return nativeFetch(input, init);

    const cached = readCache();
    if (cached) {
      refreshInBackground(input, init);
      return new Response(cached, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Web-Podcasts-Cache': 'hit' }
      });
    }

    const response = await nativeFetch(input, init);
    if (response.ok) {
      try { saveCache(await response.clone().text()); } catch {}
    }
    return response;
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./artwork-cache-sw.js', {
      scope: './',
      updateViaCache: 'none'
    }).then(registration => {
      registration.update().catch(() => {});
    }).catch(() => {});
  }
})();
