(() => {
  const STREAM_KEY = 'web-podcasts:stream:v1';
  const FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const PLAYHEAD_KEY = 'web-podcasts:stream-playhead:v1';
  const audio = document.querySelector('#audio');
  if (!audio) return;

  let lastSavedAt = 0;

  const normalize = value => String(value || '').toLocaleLowerCase().normalize('NFKC').trim();

  const readItems = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STREAM_KEY) || '[]');
      if (!Array.isArray(value)) return [];
      const query = normalize(localStorage.getItem(FILTER_KEY) || '');
      return query ? value.filter(item => normalize(item?.title).includes(query)) : value;
    } catch {
      return [];
    }
  };

  const writePlayhead = playhead => {
    if (!playhead?.key || !Number.isFinite(playhead.offsetSeconds) || playhead.offsetSeconds < 0) return;
    localStorage.setItem(PLAYHEAD_KEY, JSON.stringify({
      key: playhead.key,
      offsetSeconds: playhead.offsetSeconds
    }));
    lastSavedAt = Date.now();
    window.dispatchEvent(new CustomEvent('stream-playhead-change'));
  };

  const currentPlayhead = () => {
    const mode = audio.dataset.playlistMode;
    if (mode !== 'ios-hls' && mode !== 'desktop-sequential') return null;
    const items = readItems();
    if (!items.length || !Number.isFinite(audio.currentTime) || audio.currentTime < 0) return null;

    if (mode === 'desktop-sequential') {
      const src = audio.currentSrc || audio.src || '';
      const item = items.find(candidate => candidate.audio === src) || items.find(candidate => {
        try { return new URL(candidate.audio, location.href).href === src; } catch { return false; }
      });
      if (!item?.key) return null;
      return {key:item.key, offsetSeconds:audio.currentTime};
    }

    let remaining = audio.currentTime;
    for (const item of items) {
      const duration = Number(item?.durationSeconds);
      if (!Number.isFinite(duration) || duration <= 0) continue;
      if (remaining < duration) return {key:item.key, offsetSeconds:remaining};
      remaining -= duration;
    }
    const last = items[items.length - 1];
    if (!last?.key) return null;
    return {key:last.key, offsetSeconds:Math.max(0, Number(last.durationSeconds) || 0)};
  };

  const saveNow = () => {
    const playhead = currentPlayhead();
    if (playhead) writePlayhead(playhead);
  };

  audio.addEventListener('timeupdate', () => {
    if (Date.now() - lastSavedAt < 10000) return;
    saveNow();
  });
  audio.addEventListener('pause', saveNow);
  audio.addEventListener('ended', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveNow();
  });
  window.addEventListener('pagehide', saveNow);
})();
