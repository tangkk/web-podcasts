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

  const isStreamHls = () => audio.dataset.streamHls === '1';

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
    if (isStreamHls()) return;
    clearStableReset();
    stableTimer = setTimeout(() => {
      retryCount = 0;
    }, STABLE_RESET_MS);
  }

  async function reconnect(reason) {
    if (isStreamHls() || !shouldPlay || reconnecting) return;
    rememberPlayback();
    const source = lastSource;
    if (!source) return;

    reconnecting = true;
    clearRetry();
    clearStall();
    clearStableReset();

    const resumeAt = lastPosition;
    const playbackRate = audio.playbackRate || 1;

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
    } catch {
      retryCount += 1;
      reconnecting = false;
      scheduleRetry('retry-after-failure');
      return;
    } finally {
      reconnecting = false;
    }
  }

  function scheduleRetry(reason) {
    if (isStreamHls() || !shouldPlay || retryTimer || reconnecting) return;
    if (!navigator.onLine) return;
    const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
    retryTimer = setTimeout(() => {
      retryTimer = null;
      reconnect(reason);
    }, delay);
  }

  function startStallWatch(reason) {
    if (isStreamHls() || !shouldPlay || stallTimer) return;
    rememberPlayback();
    stallTimer = setTimeout(() => {
      stallTimer = null;
      if (shouldPlay && !audio.ended) scheduleRetry(`${reason}-timeout`);
    }, STALL_TIMEOUT);
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

  audio.addEventListener('pause', () => {
    rememberPlayback();
    if (reconnecting) return;
    shouldPlay = false;
    clearRetry();
    clearStall();
  });

  audio.addEventListener('playing', () => {
    shouldPlay = true;
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
    if (isStreamHls() || !shouldPlay) return;
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
  });

  window.addEventListener('offline', clearRetry);

  window.addEventListener('online', () => {
    if (!isStreamHls() && shouldPlay && (audio.paused || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA)) {
      scheduleRetry('network-online');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!isStreamHls() && !document.hidden && shouldPlay && !audio.ended && (audio.paused || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA)) {
      scheduleRetry('page-resumed');
    }
  });
})();