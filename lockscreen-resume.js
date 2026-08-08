(() => {
  if (!('mediaSession' in navigator)) return;

  const audio = document.querySelector('#audio');
  if (!audio) return;

  function refreshPosition(position = audio.currentTime) {
    const duration = audio.duration;
    const rate = audio.playbackRate || 1;
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: rate,
        position: Math.min(Math.max(0, position), duration)
      });
    } catch {}
  }

  function refreshPlaybackState() {
    try {
      navigator.mediaSession.playbackState = audio.ended ? 'none' : (audio.paused ? 'paused' : 'playing');
    } catch {}
  }

  // Do not install custom play/pause handlers here. On iOS, a backgrounded web
  // page may have JavaScript suspended, so custom Media Session handlers can stop
  // responding even though the native media element itself can still be controlled
  // by the lock-screen media UI. Leave those actions to Safari/iOS directly.
  audio.addEventListener('loadedmetadata', () => refreshPosition(audio.currentTime));
  audio.addEventListener('play', () => {
    refreshPlaybackState();
    refreshPosition(audio.currentTime);
  });
  audio.addEventListener('playing', () => {
    refreshPlaybackState();
    refreshPosition(audio.currentTime);
  });
  audio.addEventListener('pause', () => {
    refreshPlaybackState();
    refreshPosition(audio.currentTime);
  });
  audio.addEventListener('timeupdate', () => {
    if (!audio.paused) refreshPosition(audio.currentTime);
  });
  audio.addEventListener('ratechange', () => refreshPosition(audio.currentTime));
})();
