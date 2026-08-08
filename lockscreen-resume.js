(() => {
  if (!('mediaSession' in navigator)) return;

  const audio = document.querySelector('#audio');
  if (!audio) return;

  let pausedPosition = 0;
  let pausedRate = 1;

  function debug(message, detail) {
    const log = document.querySelector('#debugLog');
    if (!log) return;
    const suffix = detail ? ` · ${JSON.stringify(detail)}` : '';
    log.textContent += `[${new Date().toLocaleTimeString('zh-Hant', { hour12: false })}] ${message}${suffix}\n`;
    log.scrollTop = log.scrollHeight;
  }

  function rememberPause() {
    if (Number.isFinite(audio.currentTime)) pausedPosition = audio.currentTime;
    pausedRate = audio.playbackRate || 1;
  }

  function refreshPosition(position = audio.currentTime) {
    const duration = audio.duration;
    const rate = audio.playbackRate || pausedRate || 1;
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: rate,
        position: Math.min(Math.max(0, position), duration)
      });
    } catch {}
  }

  function resumeFromLockScreen() {
    const resumeAt = Number.isFinite(audio.currentTime) ? audio.currentTime : pausedPosition;
    const rate = pausedRate || audio.playbackRate || 1;
    debug('Lock-screen resume starting', { resumeAt, readyState: audio.readyState, networkState: audio.networkState });

    // Keep the same media element/source alive. Reassigning src + load() makes iOS
    // tear down and recreate the lock-screen media session, which causes the card
    // to disappear briefly and its position to reset.
    audio.playbackRate = rate;
    refreshPosition(resumeAt);
    try { navigator.mediaSession.playbackState = 'playing'; } catch {}

    const promise = audio.play();
    if (promise?.then) {
      promise.then(() => {
        refreshPosition(audio.currentTime);
      }).catch(error => {
        debug('Lock-screen direct play rejected', { name: error?.name, message: error?.message });
      });
    }
  }

  audio.addEventListener('pause', () => {
    if (!audio.ended) {
      rememberPause();
      refreshPosition(pausedPosition);
      try { navigator.mediaSession.playbackState = 'paused'; } catch {}
    }
  });

  audio.addEventListener('playing', () => {
    refreshPosition(audio.currentTime);
    try { navigator.mediaSession.playbackState = 'playing'; } catch {}
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.paused) refreshPosition(audio.currentTime);
  });

  try {
    navigator.mediaSession.setActionHandler('play', resumeFromLockScreen);
    navigator.mediaSession.setActionHandler('pause', () => {
      rememberPause();
      refreshPosition(pausedPosition);
      try { navigator.mediaSession.playbackState = 'paused'; } catch {}
      audio.pause();
    });
  } catch (error) {
    debug('Lock-screen handler registration failed', { name: error?.name, message: error?.message });
  }
})();
