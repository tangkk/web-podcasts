(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const audio = document.querySelector('#audio');
  const playToggle = document.querySelector('#playToggle');
  if (!audio || !playToggle) return;

  const setIcon = (button, text, label, title = label) => {
    if (!button) return;
    if (button.textContent !== text) button.textContent = text;
    button.setAttribute('aria-label', label);
    button.title = title;
    button.classList.add('debug-icon-button');
  };

  function decorate() {
    document.querySelectorAll('.play-card').forEach(button => {
      const card = button.closest('.episode, .show-card');
      const playing = card?.classList.contains('is-playing') && !audio.paused;
      setIcon(button, playing ? '❚❚' : '▶', playing ? '暂停' : '播放');
    });

    setIcon(document.querySelector('#debugPlaylistStart'), '▶', '开始播放', '开始播放');
    setIcon(document.querySelector('#debugPlaylistClear'), '×', '清空播放列表', '清空播放列表');

    document.querySelectorAll('.debug-playlist-controls button[data-action]').forEach(button => {
      const action = button.dataset.action;
      if (action === 'up') setIcon(button, '↑', '上移');
      if (action === 'down') setIcon(button, '↓', '下移');
      if (action === 'remove') setIcon(button, '×', '从播放列表删除');
      button.classList.add('debug-icon-button-small');
    });
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('#playToggle') || !audio.dataset.playlistMode) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, true);

  ['play', 'pause', 'ended', 'loadedmetadata'].forEach(type => {
    audio.addEventListener(type, () => requestAnimationFrame(decorate));
  });

  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['class']});

  const style = document.createElement('style');
  style.textContent = `
    .play-card.debug-icon-button,
    #debugPlaylistStart.debug-icon-button,
    #debugPlaylistClear.debug-icon-button {
      display:inline-grid !important;
      place-items:center !important;
      width:32px !important;
      height:32px !important;
      min-width:32px !important;
      padding:0 !important;
      border:1px solid var(--ink) !important;
      border-radius:999px !important;
      background:#fff !important;
      color:var(--ink) !important;
      font-size:12px !important;
      line-height:1 !important;
      font-weight:600 !important;
      cursor:pointer !important;
    }
    .play-card.debug-icon-button:hover,
    #debugPlaylistStart.debug-icon-button:hover,
    #debugPlaylistClear.debug-icon-button:hover {
      background:var(--ink) !important;
      color:#fff !important;
    }
    .debug-playlist-toolbar .playlist-primary.debug-icon-button {
      border-color:var(--ink) !important;
      background:#fff !important;
      color:var(--ink) !important;
    }
    .debug-playlist-toolbar .playlist-primary.debug-icon-button:hover {
      background:var(--ink) !important;
      color:#fff !important;
    }
    .debug-playlist-controls .debug-icon-button-small {
      display:inline-grid !important;
      place-items:center !important;
      width:25px !important;
      height:25px !important;
      min-width:25px !important;
      padding:0 !important;
      border:1px solid var(--ink) !important;
      border-radius:999px !important;
      background:#fff !important;
      color:var(--ink) !important;
      font-size:11px !important;
      line-height:1 !important;
      cursor:pointer !important;
    }
    .debug-playlist-controls .debug-icon-button-small:hover:not(:disabled) {
      background:var(--ink) !important;
      color:#fff !important;
    }
    .debug-playlist-controls .debug-icon-button-small:disabled {
      opacity:.28 !important;
      cursor:default !important;
    }
  `;
  document.head.appendChild(style);

  decorate();
})();
