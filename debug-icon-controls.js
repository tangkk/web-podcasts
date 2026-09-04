(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const audio = document.querySelector('#audio');
  const playToggle = document.querySelector('#playToggle');
  if (!audio || !playToggle) return;

  const PLAYLIST_KEY = 'web-podcasts:debug-playlist:v2';
  const ORDER_KEY = 'web-podcasts:reverse-autoplay';
  const showCache = new Map();

  const isIOSFamily = () => {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  };

  const setIcon = (button, text, label, title = label) => {
    if (!button) return;
    if (button.textContent !== text) button.textContent = text;
    button.setAttribute('aria-label', label);
    button.title = title;
    button.classList.add('debug-icon-button');
  };

  const parseDuration = value => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parts = String(value || '').split(':').map(Number);
    if (!parts.length || parts.some(Number.isNaN)) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
  };

  const writePlaylist = queue => {
    const oldValue = localStorage.getItem(PLAYLIST_KEY);
    const newValue = JSON.stringify(queue);
    localStorage.setItem(PLAYLIST_KEY, newValue);
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: PLAYLIST_KEY,
        oldValue,
        newValue,
        storageArea: localStorage,
        url: location.href
      }));
    } catch {
      window.dispatchEvent(new CustomEvent('debug-playlist-change'));
    }
  };

  async function loadShow(showId) {
    if (showCache.has(showId)) return showCache.get(showId);
    const response = await fetch(`./shows/${encodeURIComponent(showId)}.json`, {cache:'no-store'});
    if (!response.ok) throw new Error(`show HTTP ${response.status}`);
    const show = await response.json();
    showCache.set(showId, show);
    return show;
  }

  function buildSelection(show, episodeId) {
    const reversed = localStorage.getItem(ORDER_KEY) === '1';
    const ordered = [...(show.episodes || [])].sort((a, b) => {
      const at = new Date(a.publishedAt || 0).getTime();
      const bt = new Date(b.publishedAt || 0).getTime();
      return reversed ? at - bt : bt - at;
    });
    const start = ordered.findIndex(episode => episode.id === episodeId);
    if (start < 0) throw new Error('episode not found in show');

    return ordered.slice(start, start + 10).map(episode => ({
      key: `${show.id}:${episode.id}`,
      showId: show.id,
      episodeId: episode.id,
      showName: show.name,
      title: episode.title,
      audio: episode.audio,
      duration: episode.duration,
      durationSeconds: parseDuration(episode.duration)
    })).filter(item => typeof item.audio === 'string' && item.audio.startsWith('https://') && Number.isFinite(item.durationSeconds) && item.durationSeconds > 0);
  }

  function startPreparedPlaylist() {
    const playlistTab = document.querySelector('.view-tab[data-view="playlist"]');
    playlistTab?.click();
    const start = document.querySelector('#debugPlaylistStart');
    start?.click();
  }

  async function addStreamFromCard(card, button) {
    const showId = card?.dataset.showId;
    const episodeId = card?.dataset.episodeId;
    if (!showId || !episodeId) return;

    button.disabled = true;
    try {
      const show = await loadShow(showId);
      const selected = buildSelection(show, episodeId);
      if (!selected.length) throw new Error('no playable episodes selected');
      writePlaylist(selected);
      button.textContent = '✓';
      startPreparedPlaylist();
      setTimeout(() => { button.textContent = '流'; }, 700);
    } catch (error) {
      console.warn('Stream queue add failed', error);
      button.textContent = '!';
      setTimeout(() => { button.textContent = '流'; }, 900);
    } finally {
      button.disabled = false;
    }
  }

  function decorate() {
    document.querySelectorAll('.play-card').forEach(button => {
      const card = button.closest('.episode, .show-card');
      const playing = card?.classList.contains('is-playing') && !audio.paused;
      setIcon(button, playing ? '❚❚' : '▶', playing ? '暂停' : '播放');

      if (card?.matches('.episode[data-show-id][data-episode-id]')) {
        let stream = card.querySelector('.stream-card');
        if (!stream) {
          stream = document.createElement('button');
          stream.type = 'button';
          stream.className = 'stream-card debug-icon-button';
          stream.textContent = '流';
          stream.setAttribute('aria-label', '从本集开始按当前顺序播放10集');
          stream.title = '从本集开始，按当前新→旧 / 旧→新顺序生成最多10集播放列表并播放';
          button.after(stream);
        }
      }
    });

    const streamStart = document.querySelector('#debugPlaylistStart');
    const streamActive = !!audio.dataset.playlistMode;
    const streamPlaying = streamActive && !audio.paused;
    setIcon(streamStart, streamPlaying ? '❚❚' : '▶', streamPlaying ? '暂停流' : (streamActive ? '继续流' : '开始播放'), streamPlaying ? '暂停流' : (streamActive ? '继续流' : '开始播放'));
    setIcon(document.querySelector('#debugPlaylistClear'), '×', '清空播放列表', '清空播放列表');
    setIcon(document.querySelector('#syncToggle'), '⟳', '设备同步', '设备同步');

    document.querySelectorAll('.debug-playlist-controls button[data-action]').forEach(button => {
      const action = button.dataset.action;
      if (action === 'up') setIcon(button, '↑', '上移');
      if (action === 'down') setIcon(button, '↓', '下移');
      if (action === 'remove') setIcon(button, '×', '从播放列表删除');
      button.classList.add('debug-icon-button-small');
    });
  }

  document.addEventListener('click', event => {
    const streamButton = event.target.closest('.stream-card');
    if (streamButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      addStreamFromCard(streamButton.closest('.episode'), streamButton);
      return;
    }

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
    .stream-card.debug-icon-button,
    #debugPlaylistStart.debug-icon-button,
    #debugPlaylistClear.debug-icon-button,
    #syncToggle.debug-icon-button {
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
    .stream-card.debug-icon-button:hover,
    #debugPlaylistStart.debug-icon-button:hover,
    #debugPlaylistClear.debug-icon-button:hover,
    #syncToggle.debug-icon-button:hover {
      background:var(--ink) !important;
      color:#fff !important;
    }
    #syncToggle.debug-icon-button { align-self:center !important; }
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
    .debug-playlist-controls .debug-icon-button-small:disabled,
    .stream-card:disabled {
      opacity:.28 !important;
      cursor:default !important;
    }
  `;
  document.head.appendChild(style);

  decorate();
})();