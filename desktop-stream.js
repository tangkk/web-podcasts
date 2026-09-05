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
  const ORDER_KEY = 'web-podcasts:reverse-autoplay';
  const showCache = new Map();
  let sequential = null;

  const parseDuration = value => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parts = String(value || '').split(':').map(Number);
    if (!parts.length || parts.some(Number.isNaN)) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
  };

  const writePlaylist = queue => {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('stream-change'));
  };

  const readPlaylist = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const sameSrc = url => {
    if (!url) return false;
    try {
      return new URL(audio.currentSrc || audio.src, location.href).href === new URL(url, location.href).href;
    } catch {
      return (audio.currentSrc || audio.src) === url;
    }
  };

  async function loadShow(showId) {
    if (showCache.has(showId)) return showCache.get(showId);
    const response = await fetch(`./shows/${encodeURIComponent(showId)}.json`, {cache:'no-store'});
    if (!response.ok) throw new Error(`show HTTP ${response.status}`);
    const show = await response.json();
    showCache.set(showId, show);
    return show;
  }

  function buildSelection(show, episodeId) {
    const reversed = localStorage.getItem(ORDER_KEY) === '1';
    const ordered = [...(show.episodes || [])].sort((a, b) => {
      const at = new Date(a.publishedAt || 0).getTime();
      const bt = new Date(b.publishedAt || 0).getTime();
      return reversed ? at - bt : bt - at;
    });
    const start = ordered.findIndex(episode => episode.id === episodeId);
    if (start < 0) throw new Error('episode not found in show');
    return ordered.slice(start, start + 10).map(episode => ({
      key: `${show.id}:${episode.id}`,
      showId: show.id,
      episodeId: episode.id,
      showName: show.name,
      title: episode.title,
      audio: episode.audio,
      artwork: show.artwork || '',
      publisher: show.publisher || '',
      duration: episode.duration,
      durationSeconds: parseDuration(episode.duration)
    })).filter(item => typeof item.audio === 'string' && item.audio.startsWith('https://') && Number.isFinite(item.durationSeconds) && item.durationSeconds > 0);
  }

  function summaryEpisode(showId, episodeId) {
    if (typeof state === 'undefined') return null;
    const show = state.detailShow?.id === showId ? state.detailShow : state.shows?.find(item => item.id === showId);
    const episode = show?.episodes?.find(item => item.id === episodeId);
    return show && episode ? {show, episode} : null;
  }

  function updatePlayer(item) {
    player.hidden = false;
    if (artwork) artwork.src = item?.artwork || '';
    if (nowShow) nowShow.textContent = item?.showName || '';
    if (nowTitle) nowTitle.textContent = item?.title || '';
  }

  async function playSequentialIndex(index, {reuseCurrent = false} = {}) {
    if (!sequential?.items?.length) return;
    const item = sequential.items[index];
    if (!item) return;
    sequential.index = index;
    audio.dataset.playlistMode = 'desktop-sequential';
    updatePlayer(item);

    if (reuseCurrent && sameSrc(item.audio)) {
      if (audio.paused) await audio.play();
      return;
    }

    audio.src = item.audio;
    audio.load();
    await audio.play();
  }

  function attachPreparedQueue(items) {
    if (!items.length) return;
    const currentIndex = Math.max(0, items.findIndex(item => sameSrc(item.audio)));
    sequential = {items, index:currentIndex};
    audio.dataset.playlistMode = 'desktop-sequential';
    updatePlayer(items[currentIndex]);
  }

  function beginCurrentEpisode(show, episode) {
    const item = {
      showName: show.name || '',
      title: episode.title || '',
      audio: episode.audio,
      artwork: show.artwork || ''
    };
    sequential = {items:[item], index:0};
    audio.dataset.playlistMode = 'desktop-stream-preparing';
    updatePlayer(item);
    audio.src = episode.audio;
    audio.load();
    audio.play().catch(error => console.warn('Desktop stream initial play failed', error));
  }

  function openStreamTab() {
    document.querySelector('.view-tab[data-view="playlist"]')?.click();
  }

  window.addEventListener('click', event => {
    const streamButton = event.target.closest?.('.stream-card');
    if (streamButton) {
      const card = streamButton.closest('.episode[data-show-id][data-episode-id]');
      if (!card) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const showId = card.dataset.showId;
      const episodeId = card.dataset.episodeId;
      const summary = summaryEpisode(showId, episodeId);
      if (summary?.episode?.audio) beginCurrentEpisode(summary.show, summary.episode);

      streamButton.disabled = true;
      streamButton.textContent = '…';
      loadShow(showId).then(show => {
        const selected = buildSelection(show, episodeId);
        if (!selected.length) throw new Error('no playable episodes selected');
        writePlaylist(selected);
        attachPreparedQueue(selected);
        streamButton.textContent = '✓';
        openStreamTab();
        setTimeout(() => { streamButton.textContent = '流'; }, 700);
      }).catch(error => {
        console.warn('Desktop stream preparation failed', error);
        streamButton.textContent = '!';
        setTimeout(() => { streamButton.textContent = '流'; }, 900);
      }).finally(() => {
        streamButton.disabled = false;
      });
      return;
    }

    const startButton = event.target.closest?.('#streamStart');
    if (!startButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const items = readPlaylist();
    if (!items.length) return;

    const current = sequential?.items?.[sequential.index];
    if (current && sameSrc(current.audio)) {
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
    if (!audio.dataset.playlistMode?.startsWith('desktop')) return;
    const item = sequential?.items?.[sequential.index] || readPlaylist().find(entry => sameSrc(entry.audio));
    if (item) updatePlayer(item);
  });
})();