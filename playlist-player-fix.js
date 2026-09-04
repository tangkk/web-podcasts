(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  const playToggle = document.querySelector('#playToggle');
  const closePlayer = document.querySelector('#closePlayer');
  if (!audio || !player || !playToggle || !closePlayer) return;

  const playlistTab = () => document.querySelector('.view-tab[data-view="playlist"]');
  const playlistTabActive = () => !!playlistTab()?.classList.contains('active');
  const playlistPlaybackActive = () => !!audio.dataset.playlistMode;

  const restorePlaylistView = () => {
    const tab = playlistTab();
    if (!tab) return;
    requestAnimationFrame(() => {
      if (!document.querySelector('.debug-playlist-view') && !document.querySelector('#debugPlaylistStart')) {
        tab.click();
      } else {
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
      }
    });
  };

  document.addEventListener('click', event => {
    if (event.target.closest('#playToggle') && playlistPlaybackActive()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return;
    }

    if (event.target.closest('#closePlayer') && (playlistPlaybackActive() || playlistTabActive())) {
      event.preventDefault();
      event.stopImmediatePropagation();
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      delete audio.dataset.playlistMode;
      delete audio.dataset.hlsMock;
      player.hidden = true;
      restorePlaylistView();
    }
  }, true);
})();
