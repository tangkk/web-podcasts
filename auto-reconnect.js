(() => {
  const audio = document.querySelector('#audio');
  if (!audio) return;

  const RETRY_DELAYS = [0, 2000, 5000, 10000, 20000, 30000];
  const STALL_TIMEOUT = 20000;
  const STABLE_RESET_MS = 10000;

  let shouldPlay = false;
  let retryCount = 0;
  let retryTimer = null;
  let stallTimer = null;
  let stableTimer = null;
  let reconnecting = false;
  let lastSource = '';
  let lastPosition = 0;

  function debug(message, detail) {
    const log = document.querySelector('#debugLog');
    if (!log) return;
    const suffix = detail ? ` · ${JSON.stringify(detail)}` : '';
    log.textContent += `[${new Date().toLocaleTimeString('zh-Hant', { hour12: false })}] ${message}${suffix}\n`;
    log.scrollTop = log.scrollHeight;
  }

  function clearRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function clearStall() {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = null;
  }

  function clearStableReset() {
    if (stableTimer) clearTimeout(stableTimer);
    stableTimer = null;
  }

  function rememberPlayback() {
    const source = audio.currentSrc || audio.src;
    if (source) lastSource = source;
    if (Number.isFinite(audio.currentTime)) lastPosition = audio.currentTime;
  }

  function scheduleStableReset() {
    clearStableReset();
    stableTimer = setTimeout(() => {
      retryCount = 0;
      debug('Reconnect retry counter reset after stable playback');
    }, STABLE_RESET_MS);
  }

  async function reconnect(reason) {
    if (!shouldPlay || reconnecting) return;
    rememberPlayback();
    const source = lastSource;
    if (!source) return;

    reconnecting = true;
    clearRetry();
    clearStall();
    clearStableReset();

    const resumeAt = lastPosition;
    const playbackRate = audio.playbackRate || 1;
    debug('Reconnect starting', { reason, attempt: retryCount + 1, resumeAt, source });

    try {
      audio.pause();
      audio.src = source;
      audio.load();

      await new Promise((resolve, reject) => {
        const onReady = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(audio.error || new Error('media load failed')); };
        const timeout = setTimeout(() => { cleanup(); reject(new Error('media load timeout')); }, 15000);
        const cleanup = () => {
          clearTimeout(timeout);
          audio.removeEventListener('loadedmetadata', onReady);
          audio.removeEventListener('canplay', onReady);
          audio.removeEventListener('error', onError);
        };
        audio.addEventListener('loadedmetadata', onReady, { once: true });
        audio.addEventListener('canplay', onReady, { once: true });
        audio.addEventListener('error', onError, { once: true });
      });

      if (resumeAt > 0 && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(resumeAt, Math.max(0, audio.duration - 0.25));
      } else if (resumeAt > 0) {
        try { audio.currentTime = resumeAt; } catch {}
      }
      audio.playbackRate = playbackRate;
      await audio.play();
      debug('Reconnect succeeded', { resumeAt: audio.currentTime });
    } catch (error) {
      debug('Reconnect failed', { name: error?.name, message: error?.message });
      retryCount += 1;
      scheduleRetry('retry-after-failure');
    } finally {
      reconnecting = false;
    }
  }

  function scheduleRetry(reason) {
    if (!shouldPlay || retryTimer || reconnecting) return;
    if (!navigator.onLine) {
      debug('Reconnect waiting for network', { reason });
      return;
    }
    const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
    debug('Reconnect scheduled', { reason, delayMs: delay, attempt: retryCount + 1 });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      reconnect(reason);
    }, delay);
  }

  function startStallWatch(reason) {
    if (!shouldPlay || stallTimer) return;
    rememberPlayback();
    stallTimer = setTimeout(() => {
      stallTimer = null;
      if (shouldPlay && !audio.ended) scheduleRetry(`${reason}-timeout`);
    }, STALL_TIMEOUT);
    debug('Playback stall watch started', { reason, timeoutMs: STALL_TIMEOUT });
  }

  document.addEventListener('click', event => {
    const playButton = event.target.closest('#playToggle');
    if (playButton) shouldPlay = audio.paused;

    const cardButton = event.target.closest('.play-card');
    if (cardButton) shouldPlay = !cardButton.textContent.includes('暫停');

    if (event.target.closest('#closePlayer')) {
      shouldPlay = false;
      clearRetry();
      clearStall();
      clearStableReset();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.code === 'Space' && !['INPUT', 'BUTTON'].includes(document.activeElement?.tagName)) {
      shouldPlay = audio.paused;
    }
  }, true);

  audio.addEventListener('play', () => {
    shouldPlay = true;
    rememberPlayback();
  });

  audio.addEventListener('playing', () => {
    clearRetry();
    clearStall();
    rememberPlayback();
    scheduleStableReset();
  });

  audio.addEventListener('timeupdate', () => {
    rememberPlayback();
    clearStall();
  });

  audio.addEventListener('waiting', () => startStallWatch('waiting'));
  audio.addEventListener('stalled', () => startStallWatch('stalled'));
  audio.addEventListener('error', () => {
    if (!shouldPlay) return;
    rememberPlayback();
    retryCount += 1;
    scheduleRetry('audio-error');
  });

  audio.addEventListener('ended', () => {
    shouldPlay = false;
    clearRetry();
    clearStall();
    clearStableReset();
    retryCount = 0;
    debug('Episode ended normally; reconnect disabled');
  });

  window.addEventListener('offline', () => {
    if (shouldPlay) debug('Network offline during playback');
    clearRetry();
  });

  window.addEventListener('online', () => {
    if (shouldPlay && (audio.paused || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA)) {
      scheduleRetry('network-online');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && shouldPlay && !audio.ended && (audio.paused || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA)) {
      scheduleRetry('page-resumed');
    }
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        shouldPlay = true;
        audio.play().catch(() => scheduleRetry('media-session-play'));
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        shouldPlay = false;
        clearRetry();
        clearStall();
        audio.pause();
      });
    } catch {}
  }
})();
