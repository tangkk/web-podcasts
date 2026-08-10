(() => {
  const audio = document.querySelector('#audio');
  const timerButton = document.querySelector('#sleepTimer');
  if (!audio || !timerButton) return;

  let timerDeadline = 0;
  let stopAfterEpisode = false;
  let timerHandle = null;

  const menu = document.createElement('div');
  menu.className = 'sleep-menu';
  menu.hidden = true;
  menu.innerHTML = `
    <button type="button" data-sleep-minutes="15">15 分鐘</button>
    <button type="button" data-sleep-minutes="30">30 分鐘</button>
    <button type="button" data-sleep-minutes="45">45 分鐘</button>
    <button type="button" data-sleep-minutes="60">60 分鐘</button>
    <button type="button" data-sleep-episode>播完本集</button>
    <button type="button" data-sleep-cancel>取消定時</button>
  `;
  document.body.appendChild(menu);

  function latestEpisodeQueue() {
    if (typeof filteredShows !== 'function') return [];
    return filteredShows()
      .flatMap(show => (show.episodes || []).slice(0, 3).map(episode => ({ show, episode })))
      .sort((a, b) => new Date(b.episode.publishedAt || 0) - new Date(a.episode.publishedAt || 0))
      .slice(0, 120);
  }

  async function playNextVisibleEpisode() {
    if (!state?.current || typeof toggleEpisode !== 'function') return;
    const queue = latestEpisodeQueue();
    if (!queue.length) return;
    const currentIndex = queue.findIndex(({ show, episode }) =>
      show.id === state.current.showId && episode.id === state.current.episodeId
    );
    const next = currentIndex >= 0 ? queue[currentIndex + 1] : queue[0];
    if (!next) return;
    try {
      await toggleEpisode(next.show, next.episode);
      if (typeof log === 'function') log('Autoplay next episode', { show: next.show.name, episode: next.episode.title });
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
    playNextVisibleEpisode();
  });

  updateTimerButton();
})();
