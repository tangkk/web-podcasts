(() => {
  const audio = document.querySelector('#audio');
  if (!audio) return;

  const CHECK_DELAY_MS = 1800;
  const MIN_PROGRESS_SECONDS = 0.2;
  const REPAIR_COOLDOWN_MS = 5000;

  let sawPause = false;
  let repairing = false;
  let lastRepairAt = 0;
  let checkTimer = null;

  const isStreamHls = () => audio.dataset.streamHls === '1';

  function clearCheck() {
    if (checkTimer) clearTimeout(checkTimer);
    checkTimer = null;
  }

  function waitUntilReady(timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve();
        return;
      }
      const onReady = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(audio.error || new Error('media load failed')); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('media load timeout')); }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        audio.removeEventListener('loadedmetadata', onReady);
        audio.removeEventListener('canplay', onReady);
        audio.removeEventListener('error', onError);
      };
      audio.addEventListener('loadedmetadata', onReady, { once: true });
      audio.addEventListener('canplay', onReady, { once: true });
      audio.addEventListener('error', onError, { once: true });
    });
  }

  async function repairSilentResume(startPosition) {
    const now = Date.now();
    if (isStreamHls() || repairing || now - lastRepairAt < REPAIR_COOLDOWN_MS || audio.paused || audio.ended) return;

    const source = audio.currentSrc || audio.src;
    if (!source) return;

    repairing = true;
    lastRepairAt = now;
    const resumeAt = Number.isFinite(audio.currentTime) ? audio.currentTime : startPosition;
    const rate = audio.playbackRate || 1;

    try {
      audio.pause();
      audio.src = source;
      audio.load();
      await waitUntilReady();
      if (resumeAt > 0) {
        const duration = audio.duration;
        const target = Number.isFinite(duration) && duration > 0
          ? Math.min(resumeAt, Math.max(0, duration - 0.25))
          : resumeAt;
        try { audio.currentTime = target; } catch {}
      }
      audio.playbackRate = rate;
      await audio.play();
    } catch (error) {
      console.warn('Resume repair failed', error);
    } finally {
      repairing = false;
    }
  }

  audio.addEventListener('pause', () => {
    if (isStreamHls()) { sawPause = false; clearCheck(); return; }
    if (!audio.ended) sawPause = true;
    clearCheck();
  });

  audio.addEventListener('play', () => {
    if (isStreamHls()) { sawPause = false; clearCheck(); return; }
    if (!sawPause || repairing) return;
    sawPause = false;
    clearCheck();
    const startPosition = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    checkTimer = setTimeout(() => {
      checkTimer = null;
      if (isStreamHls() || audio.paused || audio.ended || repairing) return;
      const advanced = (Number.isFinite(audio.currentTime) ? audio.currentTime : startPosition) - startPosition;
      if (advanced < MIN_PROGRESS_SECONDS) repairSilentResume(startPosition);
    }, CHECK_DELAY_MS);
  });

  audio.addEventListener('playing', clearCheck);
  audio.addEventListener('timeupdate', () => {
    if (!audio.paused) clearCheck();
  });
  audio.addEventListener('ended', () => {
    sawPause = false;
    clearCheck();
  });
})();