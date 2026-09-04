(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const ua = navigator.userAgent || '';
  const isIOSFamily = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOSFamily) return;

  const audio = document.querySelector('#audio');
  if (!audio) return;

  const streamActive = () => audio.dataset.playlistMode === 'ios-hls';

  function syncButton() {
    const button = document.querySelector('#debugPlaylistStart');
    if (!button) return;
    const playing = streamActive() && !audio.paused && !audio.ended;
    button.textContent = playing ? '❚❚' : '▶';
    button.setAttribute('aria-label', playing ? '暂停流' : (streamActive() ? '继续播放流' : '开始播放流'));
    button.title = playing ? '暂停流' : (streamActive() ? '继续播放流' : '开始播放流');
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#debugPlaylistStart');
    if (!button || !streamActive()) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (audio.paused || audio.ended) {
      audio.play().catch(error => console.warn('iOS stream resume failed', error));
    } else {
      audio.pause();
    }
  }, true);

  ['play', 'pause', 'ended', 'loadedmetadata'].forEach(type => {
    audio.addEventListener(type, () => requestAnimationFrame(syncButton));
  });

  const observer = new MutationObserver(() => requestAnimationFrame(syncButton));
  observer.observe(document.body, {subtree:true, childList:true});

  syncButton();
})();
