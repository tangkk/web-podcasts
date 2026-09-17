(() => {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1200, 3000, 7000];
  const ARTWORK_SELECTOR = 'img.artwork, img.detail-artwork, img.player-artwork, .recent-list img';
  const retryState = new WeakMap();

  const isArtwork = img => img instanceof HTMLImageElement && img.matches(ARTWORK_SELECTOR);

  function baseUrl(img) {
    const raw = img.getAttribute('src') || img.src || '';
    if (!raw) return '';
    try {
      const url = new URL(raw, location.href);
      url.searchParams.delete('__artwork_retry');
      return url.href;
    } catch {
      return raw;
    }
  }

  function retryUrl(source, attempt) {
    try {
      const url = new URL(source, location.href);
      url.searchParams.set('__artwork_retry', `${attempt}-${Date.now()}`);
      return url.href;
    } catch {
      const separator = source.includes('?') ? '&' : '?';
      return `${source}${separator}__artwork_retry=${attempt}-${Date.now()}`;
    }
  }

  function scheduleRetry(img) {
    if (!isArtwork(img) || !img.isConnected) return;
    const source = baseUrl(img);
    if (!source) return;

    let state = retryState.get(img);
    if (state && state.source !== source) {
      if (state.timer) clearTimeout(state.timer);
      state = null;
    }
    if (!state) state = {source, attempt: 0, timer: null};
    retryState.set(img, state);
    if (state.timer || state.attempt >= MAX_RETRIES) return;

    const attempt = ++state.attempt;
    state.timer = setTimeout(() => {
      state.timer = null;
      if (!img.isConnected || baseUrl(img) !== source || (img.complete && img.naturalWidth > 0)) return;
      img.src = retryUrl(source, attempt);
    }, RETRY_DELAYS[attempt - 1]);
  }

  function markLoaded(img) {
    if (!isArtwork(img)) return;
    const state = retryState.get(img);
    if (state?.timer) clearTimeout(state.timer);
    retryState.delete(img);
  }

  function repairBrokenArtwork() {
    document.querySelectorAll(ARTWORK_SELECTOR).forEach(img => {
      if (!img.getAttribute('src')) return;
      if (img.complete && img.naturalWidth === 0) scheduleRetry(img);
    });
  }

  document.addEventListener('error', event => {
    if (isArtwork(event.target)) scheduleRetry(event.target);
  }, true);

  document.addEventListener('load', event => {
    if (isArtwork(event.target)) markLoaded(event.target);
  }, true);

  window.addEventListener('pageshow', () => {
    setTimeout(repairBrokenArtwork, 250);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(repairBrokenArtwork, 250);
  });
})();