(() => {
  const mainAudio = document.querySelector('#audio');
  if (!mainAudio) return;

  const ORDER_KEY = 'web-podcasts:reverse-autoplay';
  const slots = [0, 1].map(index => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.hidden = true;
    audio.dataset.queueSlot = String(index + 1);
    document.body.appendChild(audio);
    return audio;
  });

  let preparedKey = '';

  function reverseAutoplay() {
    return localStorage.getItem(ORDER_KEY) === '1';
  }

  function sortByPlaybackOrder(a, b) {
    const aTime = new Date(a.episode?.publishedAt || a.publishedAt || 0);
    const bTime = new Date(b.episode?.publishedAt || b.publishedAt || 0);
    return reverseAutoplay() ? aTime - bTime : bTime - aTime;
  }

  function latestEpisodeQueue() {
    if (typeof filteredShows !== 'function') return [];
    return filteredShows()
      .flatMap(show => (show.episodes || []).slice(0, 3).map(episode => ({ show, episode })))
      .sort(sortByPlaybackOrder)
      .slice(0, 120);
  }

  function detailEpisodeQueue() {
    const show = state?.detailShow;
    if (!show || !state?.current || show.id !== state.current.showId) return [];
    return [...(show.episodes || [])]
      .sort(sortByPlaybackOrder)
      .map(episode => ({ show, episode }));
  }

  function upcomingEpisodes() {
    if (!state?.current) return [];
    const detailQueue = detailEpisodeQueue();
    const queue = detailQueue.length ? detailQueue : latestEpisodeQueue();
    if (!queue.length) return [];
    const index = queue.findIndex(({ show, episode }) =>
      show.id === state.current.showId && episode.id === state.current.episodeId
    );
    if (index < 0) return [];
    return queue.slice(index + 1, index + 3);
  }

  function clearSlot(audio) {
    audio.removeAttribute('src');
    audio.load();
    delete audio.dataset.showId;
    delete audio.dataset.episodeId;
  }

  function prepareQueue() {
    const next = upcomingEpisodes();
    const key = `${reverseAutoplay() ? 'reverse' : 'default'}|${next.map(({ show, episode }) => `${show.id}:${episode.id}`).join('|')}`;
    if (key === preparedKey) return;
    preparedKey = key;

    slots.forEach((slot, index) => {
      const item = next[index];
      if (!item?.episode?.audio) {
        clearSlot(slot);
        return;
      }
      if (slot.src === item.episode.audio) return;
      slot.preload = 'metadata';
      slot.src = item.episode.audio;
      slot.dataset.showId = item.show.id;
      slot.dataset.episodeId = item.episode.id;
      slot.load();
    });

    if (typeof log === 'function' && next.length) {
      log('Background queue prepared', {
        order: reverseAutoplay() ? 'old-to-new' : 'new-to-old',
        episodes: next.map(({ show, episode }) => `${show.name} — ${episode.title}`)
      });
    }
  }

  mainAudio.addEventListener('play', prepareQueue);
  mainAudio.addEventListener('loadedmetadata', prepareQueue);
  mainAudio.addEventListener('ended', () => {
    preparedKey = '';
    window.setTimeout(prepareQueue, 0);
  });

  document.addEventListener('web-podcasts:playback-order-change', () => {
    preparedKey = '';
    prepareQueue();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') prepareQueue();
  });
})();
