(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const ua = navigator.userAgent || '';
  const isIOSFamily = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOSFamily) return;

  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  const artwork = document.querySelector('#playerArtwork');
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  if (!audio || !player) return;

  const PLAYLIST_KEY = 'web-podcasts:debug-playlist:v2';
  const ORDER_KEY = 'web-podcasts:reverse-autoplay';
  const showCache = new Map();

  const parseDuration = value => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parts = String(value || '').split(':').map(Number);
    if (!parts.length || parts.some(Number.isNaN)) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
  };

  const writePlaylist = queue => {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('debug-playlist-change'));
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

  function beginCurrentEpisode(show, episode) {
    player.hidden = false;
    if (artwork) artwork.src = show.artwork || '';
    if (nowShow) nowShow.textContent = show.name || '';
    if (nowTitle) nowTitle.textContent = episode.title || '';
    audio.dataset.playlistMode = 'desktop-stream-preparing';
    audio.src = episode.audio;
    audio.load();
    audio.play().catch(error => console.warn('Desktop stream initial play failed', error));
  }

  function startPreparedPlaylist() {
    document.querySelector('.view-tab[data-view="playlist"]')?.click();
    document.querySelector('#debugPlaylistStart')?.click();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.stream-card');
    if (!button) return;
    const card = button.closest('.episode[data-show-id][data-episode-id]');
    if (!card) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const showId = card.dataset.showId;
    const episodeId = card.dataset.episodeId;
    const summary = summaryEpisode(showId, episodeId);
    if (summary?.episode?.audio) beginCurrentEpisode(summary.show, summary.episode);

    button.disabled = true;
    button.textContent = '…';
    loadShow(showId).then(show => {
      const selected = buildSelection(show, episodeId);
      if (!selected.length) throw new Error('no playable episodes selected');
      writePlaylist(selected);
      button.textContent = '✓';
      startPreparedPlaylist();
      setTimeout(() => { button.textContent = '流'; }, 700);
    }).catch(error => {
      console.warn('Desktop stream preparation failed', error);
      button.textContent = '!';
      setTimeout(() => { button.textContent = '流'; }, 900);
    }).finally(() => {
      button.disabled = false;
    });
  }, true);

  audio.addEventListener('play', () => {
    if (!audio.dataset.playlistMode?.startsWith('desktop')) return;
    let queue = [];
    try { queue = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || '[]'); } catch {}
    if (!Array.isArray(queue) || !queue.length) return;
    const current = queue.find(item => item.audio === audio.currentSrc || item.audio === audio.src) || queue[0];
    if (artwork && current?.artwork) artwork.src = current.artwork;
  });
})();
