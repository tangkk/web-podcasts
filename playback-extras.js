(() => {
  const audio = document.querySelector('#audio');
  const timerButton = document.querySelector('#sleepTimer');
  if (!audio || !timerButton) return;

  const ORDER_KEY = 'web-podcasts:reverse-autoplay';
  let timerDeadline = 0;
  let stopAfterEpisode = false;
  let timerHandle = null;

  function reverseAutoplay() {
    return localStorage.getItem(ORDER_KEY) === '1';
  }

  function sortByPlaybackOrder(a, b) {
    const aTime = new Date(a.episode?.publishedAt || a.publishedAt || 0);
    const bTime = new Date(b.episode?.publishedAt || b.publishedAt || 0);
    return reverseAutoplay() ? aTime - bTime : bTime - aTime;
  }

  const orderButton = document.createElement('button');
  orderButton.id = 'playbackOrderToggle';
  orderButton.className = 'speed-toggle';
  orderButton.type = 'button';
  timerButton.after(orderButton);

  function updateOrderButton() {
    const reversed = reverseAutoplay();
    orderButton.textContent = reversed ? '舊→新' : '新→舊';
    orderButton.classList.toggle('active', reversed);
    orderButton.setAttribute('aria-pressed', String(reversed));
    orderButton.setAttribute('aria-label', reversed ? '自動播放順序：由舊到新' : '自動播放順序：由新到舊');
  }

  orderButton.addEventListener('click', () => {
    const reversed = !reverseAutoplay();
    localStorage.setItem(ORDER_KEY, reversed ? '1' : '0');
    updateOrderButton();
    document.dispatchEvent(new CustomEvent('web-podcasts:playback-order-change', { detail: { reversed } }));
    if (typeof log === 'function') log('Autoplay order changed', { order: reversed ? 'old-to-new' : 'new-to-old' });
  });

  const menu = document.createElement('div');
  menu.className = 'sleep-menu';
  menu.hidden = true;
  menu.innerHTML = `
    <button type="button" data-sleep-minutes="60">1 小時</button>
    <button type="button" data-sleep-minutes="120">2 小時</button>
    <button type="button" data-sleep-minutes="180">3 小時</button>
    <button type="button" data-sleep-minutes="240">4 小時</button>
    <button type="button" data-sleep-minutes="300">5 小時</button>
    <button type="button" data-sleep-minutes="360">6 小時</button>
    <button type="button" data-sleep-episode>播完本集</button>
    <button type="button" data-sleep-cancel>取消定時</button>
  `;
  document.body.appendChild(menu);

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

  async function playNextVisibleEpisode() {
    if (!state?.current || typeof toggleEpisode !== 'function') return;
    const detailQueue = detailEpisodeQueue();
    const queue = detailQueue.length ? detailQueue : latestEpisodeQueue();
    if (!queue.length) return;
    const currentIndex = queue.findIndex(({ show, episode }) =>
      show.id === state.current.showId && episode.id === state.current.episodeId
    );
    const next = currentIndex >= 0 ? queue[currentIndex + 1] : queue[0];
    if (!next) return;
    try {
      await toggleEpisode(next.show, next.episode);
      if (typeof log === 'function') log('Autoplay next episode', {
        show: next.show.name,
        episode: next.episode.title,
        mode: detailQueue.length ? 'show-detail' : 'latest',
        order: reverseAutoplay() ? 'old-to-new' : 'new-to-old'
      });
    } catch (error) {
      if (typeof log === 'function') log('Autoplay failed', { message: error?.message || String(error) });
    }
  }

  function updateTimerButton() {
    if (stopAfterEpisode) {
      timerButton.textContent = '本集後停';
      timerButton.classList.add('active');
      timerButton.setAttribute('aria-label', '定時關閉：播完本集');
      return;
    }
    if (timerDeadline) {
      const minutes = Math.max(1, Math.ceil((timerDeadline - Date.now()) / 60000));
      timerButton.textContent = `${minutes}m`;
      timerButton.classList.add('active');
      timerButton.setAttribute('aria-label', `定時關閉：剩餘約 ${minutes} 分鐘`);
      return;
    }
    timerButton.textContent = '定時';
    timerButton.classList.remove('active');
    timerButton.setAttribute('aria-label', '設定定時關閉');
  }

  function clearTimerHandle() {
    if (timerHandle) clearTimeout(timerHandle);
    timerHandle = null;
  }

  function cancelTimer() {
    timerDeadline = 0;
    stopAfterEpisode = false;
    clearTimerHandle();
    updateTimerButton();
  }

  function stopForTimer() {
    if (!timerDeadline || Date.now() < timerDeadline) return false;
    timerDeadline = 0;
    clearTimerHandle();
    audio.pause();
    updateTimerButton();
    if (typeof log === 'function') log('Sleep timer stopped playback');
    return true;
  }

  function setMinutes(minutes) {
    stopAfterEpisode = false;
    timerDeadline = Date.now() + minutes * 60000;
    clearTimerHandle();
    timerHandle = setTimeout(stopForTimer, minutes * 60000);
    updateTimerButton();
    if (typeof log === 'function') log('Sleep timer set', { minutes });
  }

  function positionMenu() {
    const rect = timerButton.getBoundingClientRect();
    const width = 150;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width - width))}px`;
    menu.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 8)}px`;
  }

  timerButton.addEventListener('click', event => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    if (!menu.hidden) positionMenu();
  });

  menu.addEventListener('click', event => {
    const minutesButton = event.target.closest('[data-sleep-minutes]');
    if (minutesButton) setMinutes(Number(minutesButton.dataset.sleepMinutes));

    if (event.target.closest('[data-sleep-episode]')) {
      timerDeadline = 0;
      clearTimerHandle();
      stopAfterEpisode = true;
      updateTimerButton();
      if (typeof log === 'function') log('Sleep timer set', { mode: 'end-of-episode' });
    }

    if (event.target.closest('[data-sleep-cancel]')) cancelTimer();
    menu.hidden = true;
  });

  document.addEventListener('click', event => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== timerButton) menu.hidden = true;
  });

  window.addEventListener('resize', () => {
    if (!menu.hidden) positionMenu();
  });

  audio.addEventListener('timeupdate', () => {
    if (!timerDeadline) return;
    stopForTimer();
    if (timerDeadline) updateTimerButton();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && timerDeadline) stopForTimer();
  });

  audio.addEventListener('ended', () => {
    if (stopAfterEpisode) {
      stopAfterEpisode = false;
      updateTimerButton();
      if (typeof log === 'function') log('Sleep timer stopped after episode');
      return;
    }
    if (stopForTimer()) return;

    const mode = audio.dataset.playlistMode;
    if (mode === 'ios-hls' || mode === 'desktop-sequential') return;

    playNextVisibleEpisode();
  });

  updateOrderButton();
  updateTimerButton();
})();
