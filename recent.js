(() => {
  const STORAGE_KEY = 'web-podcasts:recents';
  const MAX_RECENTS = 10;

  const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  function loadRecents() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.slice(0, MAX_RECENTS) : [];
    } catch {
      return [];
    }
  }

  function saveRecents(recents) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
  }

  function renderRecents() {
    const section = document.querySelector('#recentSection');
    const list = document.querySelector('#recentList');
    if (!section || !list) return;

    const recents = loadRecents();
    section.hidden = recents.length === 0;
    list.innerHTML = recents.map((item, index) => `
      <button class="recent-podcast" type="button" data-recent-index="${index}" title="${escapeHtml(item.episodeTitle)}">
        <span class="recent-episode">${escapeHtml(item.episodeTitle)}</span>
        <span class="recent-show">${escapeHtml(item.showName)}</span>
      </button>
    `).join('');
  }

  function currentSnapshot() {
    if (typeof state === 'undefined' || !state.current || typeof els === 'undefined') return null;
    const current = state.current;
    const show = state.detailShow?.id === current.showId
      ? state.detailShow
      : state.shows?.find(item => item.id === current.showId);
    const episode = show?.episodes?.find(item => item.id === current.episodeId);
    const existing = loadRecents().find(item => item.showId === current.showId && item.episodeId === current.episodeId);

    return {
      showId: current.showId,
      episodeId: current.episodeId,
      showName: show?.name || existing?.showName || els.nowShow?.textContent?.trim() || current.showId,
      publisher: show?.publisher || existing?.publisher || '',
      artwork: show?.artwork || existing?.artwork || els.artwork?.src || '',
      episodeTitle: episode?.title || existing?.episodeTitle || els.nowTitle?.textContent?.trim() || current.episodeId,
      audio: episode?.audio || existing?.audio || els.audio?.currentSrc || els.audio?.src || '',
      publishedAt: episode?.publishedAt || existing?.publishedAt || '',
      duration: episode?.duration || existing?.duration || ''
    };
  }

  function rememberCurrent() {
    const item = currentSnapshot();
    if (!item?.audio) return;
    const recents = loadRecents().filter(entry => !(entry.showId === item.showId && entry.episodeId === item.episodeId));
    recents.unshift(item);
    saveRecents(recents);
    renderRecents();
  }

  async function playRecent(item) {
    if (!item?.audio || typeof toggleEpisode !== 'function') return;
    const show = {
      id: item.showId,
      name: item.showName,
      publisher: item.publisher || '',
      artwork: item.artwork || '',
      episodes: []
    };
    const episode = {
      id: item.episodeId,
      title: item.episodeTitle,
      audio: item.audio,
      publishedAt: item.publishedAt || '',
      duration: item.duration || ''
    };
    await toggleEpisode(show, episode);
  }

  document.querySelector('#audio')?.addEventListener('playing', rememberCurrent);

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-recent-index]');
    if (!button) return;
    const item = loadRecents()[Number(button.dataset.recentIndex)];
    if (!item) return;
    playRecent(item).catch(() => {});
  });

  renderRecents();
})();
