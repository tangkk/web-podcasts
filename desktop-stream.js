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
  let sequential = null;

  const readPlaylist = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  function updatePlayer(item) {
    player.hidden = false;
    if (artwork) artwork.src = item?.artwork || '';
    if (nowShow) nowShow.textContent = item?.showName || '';
    if (nowTitle) nowTitle.textContent = item?.title || '';
  }

  async function playSequentialIndex(index) {
    if (!sequential?.items?.length) return;
    const item = sequential.items[index];
    if (!item) return;
    sequential.index = index;
    audio.dataset.playlistMode = 'desktop-sequential';
    delete audio.dataset.streamHls;
    updatePlayer(item);
    audio.src = item.audio;
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

    sequential = {items, index:0};
    playSequentialIndex(0).catch(error => console.warn('Desktop stream start failed', error));
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