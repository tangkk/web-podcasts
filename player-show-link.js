(() => {
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  if (!nowShow || !nowTitle) return;

  nowShow.addEventListener('click', event => {
    event.stopPropagation();
    if (typeof state === 'undefined' || !state.current?.showId || typeof openShow !== 'function') return;
    openShow(state.current.showId).catch?.(() => {});
  });

  async function revealCurrentEpisode() {
    if (typeof state === 'undefined' || !state.current?.showId || !state.current?.episodeId || typeof openShow !== 'function') return;

    const { showId, episodeId } = state.current;
    await openShow(showId);

    if (state.detailShow?.id !== showId) return;
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
})();
