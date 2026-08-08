(() => {
  const originalFetch = window.fetch.bind(window);
  let hiddenIds = new Set(['bumingbai', 'initium-audio', 'mindi', 'baodao-bros']);

  function cleanStoredIds() {
    try {
      const recents = JSON.parse(localStorage.getItem('web-podcasts:recents') || '[]');
      if (Array.isArray(recents)) {
        localStorage.setItem('web-podcasts:recents', JSON.stringify(recents.filter(item => !hiddenIds.has(item?.showId))));
      }
    } catch {}
    try {
      const favorites = JSON.parse(localStorage.getItem('web-podcasts:favorites') || '[]');
      if (Array.isArray(favorites)) {
        localStorage.setItem('web-podcasts:favorites', JSON.stringify(favorites.filter(id => !hiddenIds.has(id))));
      }
    } catch {}
  }

  cleanStoredIds();

  const policyReady = originalFetch('./political-sensitivity.json', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(policy => {
      if (Array.isArray(policy?.high)) hiddenIds = new Set(policy.high.map(item => item.id).filter(Boolean));
      cleanStoredIds();
      return hiddenIds;
    })
    .catch(() => hiddenIds);

  window.__contentPolicy = {
    ready: policyReady,
    isHidden: id => hiddenIds.has(id)
  };

  window.fetch = async function policyFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const isEpisodeCatalog = /(?:^|\/)episodes\.json(?:[?#]|$)/.test(url);
    const showMatch = url.match(/(?:^|\/)shows\/([^/?#]+)\.json(?:[?#]|$)/);

    if (!isEpisodeCatalog && !showMatch) return originalFetch(input, init);

    await policyReady;

    if (showMatch) {
      const showId = decodeURIComponent(showMatch[1]);
      if (hiddenIds.has(showId)) return new Response('', { status: 404, statusText: 'Not Found' });
      return originalFetch(input, init);
    }

    const response = await originalFetch(input, init);
    if (!response.ok) return response;

    try {
      const data = await response.clone().json();
      if (!Array.isArray(data?.shows)) return response;
      const shows = data.shows.filter(show => !hiddenIds.has(show?.id));
      const filtered = {
        ...data,
        shows,
        showCount: shows.length,
        episodeCount: shows.reduce((total, show) => total + (Array.isArray(show.episodes) ? show.episodes.length : 0), 0)
      };
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(filtered), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch {
      return response;
    }
  };
})();
