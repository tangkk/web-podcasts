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

  function resumeFromLockScreen() {
    const source = audio.currentSrc || audio.src;
    if (!source) return;

    const resumeAt = Number.isFinite(audio.currentTime) ? audio.currentTime : pausedPosition;
    const rate = audio.playbackRate || pausedRate || 1;
    debug('Lock-screen resume starting', { resumeAt, source });

    // Keep play() inside the Media Session action callback. On iOS this is
    // important: waiting for metadata first can lose the system user activation.
    audio.pause();
    audio.src = source;
    audio.load();
    audio.playbackRate = rate;

    const restorePosition = () => {
      const duration = audio.duration;
      const target = Number.isFinite(duration) && duration > 0
        ? Math.min(resumeAt, Math.max(0, duration - 0.25))
        : resumeAt;
      if (target > 0) {
        try { audio.currentTime = target; } catch {}
      }
      audio.playbackRate = rate;
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) restorePosition();
    else audio.addEventListener('loadedmetadata', restorePosition, { once: true });

    const promise = audio.play();
    if (promise?.catch) {
      promise.catch(error => {
        debug('Lock-screen immediate play rejected', { name: error?.name, message: error?.message });
      });
    }
  }

  audio.addEventListener('pause', () => {
    if (!audio.ended) rememberPause();
  });

  try {
    navigator.mediaSession.setActionHandler('play', resumeFromLockScreen);
    navigator.mediaSession.setActionHandler('pause', () => {
      rememberPause();
      audio.pause();
    });
  } catch (error) {
    debug('Lock-screen handler registration failed', { name: error?.name, message: error?.message });
  }
})();
