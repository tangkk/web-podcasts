(() => {
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  if (!nowShow || !nowTitle) return;

  nowShow.addEventListener('click', event => {
    event.stopPropagation();
    if (typeof state === 'undefined' || !state.current?.showId || typeof openShow !== 'function') return;
    openShow(state.current.showId).catch?.(() => {});
  });

  function leaveStreamView() {
    if (typeof state !== 'undefined') state.view = 'shows';
    document.querySelectorAll('.view-tab[data-view]').forEach(tab => {
      const active = tab.dataset.view === 'shows';
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  async function revealEpisode(showId, episodeId) {
    if (!showId || !episodeId || typeof openShow !== 'function') return;

    leaveStreamView();
    await openShow(showId);

    if (typeof state === 'undefined' || state.detailShow?.id !== showId) return;
    const episodeIndex = state.detailShow.episodes?.findIndex(episode => episode.id === episodeId) ?? -1;
    if (episodeIndex < 0) return;

    if (typeof state.detailVisible === 'number' && episodeIndex >= state.detailVisible && typeof renderDetail === 'function') {
      state.detailVisible = episodeIndex + 1;
      renderDetail();
    }

    requestAnimationFrame(() => {
      const cards = [...document.querySelectorAll('article[data-show-id][data-episode-id]')];
      const target = cards.find(card => card.dataset.showId === showId && card.dataset.episodeId === episodeId);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  async function revealCurrentEpisode() {
    if (typeof state === 'undefined' || !state.current?.showId || !state.current?.episodeId) return;
    await revealEpisode(state.current.showId, state.current.episodeId);
  }

  nowTitle.setAttribute('role', 'button');
  nowTitle.setAttribute('tabindex', '0');
  nowTitle.setAttribute('title', '打開目前單集');

  nowTitle.addEventListener('click', event => {
    event.stopPropagation();
    revealCurrentEpisode().catch(() => {});
  });

  nowTitle.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    revealCurrentEpisode().catch(() => {});
  });

  document.addEventListener('click', event => {
    const title = event.target.closest?.('.stream-row .episode-title[data-stream-episode-link]');
    if (!title) return;
    event.preventDefault();
    event.stopPropagation();
    const row = title.closest('.stream-row');
    revealEpisode(row?.dataset.showId, row?.dataset.episodeId).catch(() => {});
  });

  document.addEventListener('keydown', event => {
    const title = event.target.closest?.('.stream-row .episode-title[data-stream-episode-link]');
    if (!title || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    const row = title.closest('.stream-row');
    revealEpisode(row?.dataset.showId, row?.dataset.episodeId).catch(() => {});
  });
})();