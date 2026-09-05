(() => {
  const ua = navigator.userAgent || '';
  const isIOSFamily = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOSFamily) return;

  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  const artwork = document.querySelector('#playerArtwork');
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  if (!audio || !player) return;

  const PLAYLIST_KEY = 'web-podcasts:stream:v1';
  const FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const PLAYHEAD_KEY = 'web-podcasts:stream-playhead:v1';
  let sequential = null;

  const normalize = value => String(value || '').toLocaleLowerCase().normalize('NFKC').trim();
  const readPlaylist = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || '[]');
      if (!Array.isArray(value)) return [];
      const query = normalize(localStorage.getItem(FILTER_KEY) || '');
      return query ? value.filter(item => normalize(item?.title).includes(query)) : value;
    } catch { return []; }
  };
  const readPlayhead = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PLAYHEAD_KEY) || 'null');
      return value && typeof value.key === 'string' && Number.isFinite(value.offsetSeconds) ? value : null;
    } catch { return null; }
  };

  function updatePlayer(item) {
    player.hidden = false;
    if (artwork) artwork.src = item?.artwork || '';
    if (nowShow) nowShow.textContent = item?.showName || '';
    if (nowTitle) nowTitle.textContent = item?.title || '';
  }

  async function playSequentialIndex(index, offsetSeconds = 0) {
    if (!sequential?.items?.length) return;
    const item = sequential.items[index];
    if (!item) return;
    sequential.index = index;
    audio.dataset.playlistMode = 'desktop-sequential';
    delete audio.dataset.streamHls;
    updatePlayer(item);
    audio.src = item.audio;
    if (offsetSeconds > 0) {
      audio.addEventListener('loadedmetadata', () => {
        try { audio.currentTime = Math.min(offsetSeconds, Math.max(0, audio.duration - 0.25)); } catch {}
      }, {once:true});
    }
    audio.load();
    await audio.play();
  }

  window.addEventListener('click', event => {
    if (event.target.closest?.('.stream-card')) return;
    const startButton = event.target.closest?.('#streamStart');
    if (!startButton || startButton.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const items = readPlaylist();
    if (!items.length) return;

    if (audio.dataset.playlistMode === 'desktop-sequential' && sequential) {
      if (audio.paused) audio.play().catch(error => console.warn('Desktop stream resume failed', error));
      else audio.pause();
      return;
    }

    const playhead = readPlayhead();
    const restoreIndex = playhead ? items.findIndex(item => item.key === playhead.key) : -1;
    const index = restoreIndex >= 0 ? restoreIndex : 0;
    const offset = restoreIndex >= 0 ? Math.max(0, playhead.offsetSeconds) : 0;
    sequential = {items, index};
    playSequentialIndex(index, offset).catch(error => console.warn('Desktop stream start failed', error));
  }, true);

  audio.addEventListener('ended', () => {
    if (!sequential || audio.dataset.playlistMode !== 'desktop-sequential') return;
    const next = sequential.index + 1;
    if (next >= sequential.items.length) {
      sequential = null;
      delete audio.dataset.playlistMode;
      return;
    }
    playSequentialIndex(next).catch(error => console.warn('Desktop stream advance failed', error));
  });

  audio.addEventListener('play', () => {
    if (audio.dataset.playlistMode !== 'desktop-sequential') return;
    const item = sequential?.items?.[sequential.index];
    if (item) updatePlayer(item);
  });
})();