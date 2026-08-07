(() => {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;

  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  const artwork = document.querySelector('#playerArtwork');
  if (!audio || !player || !nowShow || !nowTitle) return;

  let lastMetadataKey = '';
  let lastPositionUpdate = 0;

  function currentSnapshot() {
    const artist = nowShow.textContent?.trim() || '';
    const title = nowTitle.textContent?.trim() || '';
    const artworkSrc = artwork?.src || '';
    if (player.hidden || !artist || artist === 'NOW PLAYING' || !title || title === '—') return null;
    return { artist, title, artworkSrc };
  }

  function refreshMetadata(force = false) {
    const snapshot = currentSnapshot();
    if (!snapshot) return;

    const key = `${snapshot.artist}\n${snapshot.title}\n${snapshot.artworkSrc}`;
    if (!force && key === lastMetadataKey && navigator.mediaSession.metadata) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: snapshot.title,
        artist: snapshot.artist,
        album: 'Web Podcasts',
        artwork: snapshot.artworkSrc ? [{ src: snapshot.artworkSrc }] : []
      });
      lastMetadataKey = key;
    } catch {}
  }

  function refreshPlaybackState() {
    try {
      navigator.mediaSession.playbackState = audio.ended ? 'none' : (audio.paused ? 'paused' : 'playing');
    } catch {}
  }

  function refreshPositionState(force = false) {
    const now = Date.now();
    if (!force && now - lastPositionUpdate < 5000) return;
    lastPositionUpdate = now;

    const duration = audio.duration;
    const position = audio.currentTime;
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

  function revive(force = true) {
    refreshMetadata(force);
    refreshPlaybackState();
    refreshPositionState(force);
  }

  ['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'pause'].forEach(event => {
    audio.addEventListener(event, () => revive(true));
  });

  audio.addEventListener('timeupdate', () => {
    refreshMetadata(false);
    refreshPositionState(false);
  });

  audio.addEventListener('ratechange', () => refreshPositionState(true));

  // Replacing src during automatic reconnect can make iOS temporarily drop the
  // lock-screen session. Re-declare the current episode immediately.
  audio.addEventListener('emptied', () => refreshMetadata(true));

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) revive(true);
  });

  window.addEventListener('pageshow', () => revive(true));

  // The episode title/show text is updated just before a new source is loaded.
  // Observe those changes so metadata is refreshed even before media events fire.
  const observer = new MutationObserver(() => refreshMetadata(true));
  observer.observe(nowShow, { childList: true, characterData: true, subtree: true });
  observer.observe(nowTitle, { childList: true, characterData: true, subtree: true });
})();
