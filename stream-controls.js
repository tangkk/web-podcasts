(() => {
  const audio = document.querySelector('#audio');
  const playToggle = document.querySelector('#playToggle');
  if (!audio || !playToggle) return;

  const PLAYLIST_KEY = 'web-podcasts:stream:v1';
  const ORDER_KEY = 'web-podcasts:reverse-autoplay';
  const showCache = new Map();

  const setIcon = (button, text, label, title = label) => {
    if (!button) return;
    if (button.textContent !== text) button.textContent = text;
    button.setAttribute('aria-label', label);
    button.title = title;
    button.classList.add('icon-button');
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
      window.dispatchEvent(new CustomEvent('stream-change'));
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
      artwork: show.artwork || '',
      publisher: show.publisher || '',
      duration: episode.duration,
      durationSeconds: parseDuration(episode.duration)
    })).filter(item => typeof item.audio === 'string' && item.audio.startsWith('https://') && Number.isFinite(item.durationSeconds) && item.durationSeconds > 0);
  }

  function openPreparedStream() {
    document.querySelector('.view-tab[data-view="playlist"]')?.click();
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
      openPreparedStream();
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
          stream.className = 'stream-card icon-button';
          stream.textContent = '流';
          stream.setAttribute('aria-label', '从本集开始加入最多10集到流');
          stream.title = '从本集开始，按当前新→旧 / 旧→新顺序加入最多10集，并打开流';
          button.after(stream);
        }
      }
    });

    const streamStart = document.querySelector('#streamStart');
    const streamMode = audio.dataset.playlistMode === 'ios-hls' || audio.dataset.playlistMode === 'desktop-sequential';
    const streamPlaying = streamMode && !audio.paused;
    setIcon(streamStart, streamPlaying ? '❚❚' : '▶', streamPlaying ? '暂停流' : (streamMode ? '继续流' : '播放流'), streamPlaying ? '暂停流' : (streamMode ? '继续流' : '播放流'));
    setIcon(document.querySelector('#streamClear'), '×', '清空播放列表', '清空播放列表');
    setIcon(document.querySelector('#syncToggle'), '⟳', '设备同步', '设备同步');

    document.querySelectorAll('.stream-controls button[data-action]').forEach(button => {
      const action = button.dataset.action;
      if (action === 'up') setIcon(button, '↑', '上移');
      if (action === 'down') setIcon(button, '↓', '下移');
      if (action === 'remove') setIcon(button, '×', '从播放列表删除');
      button.classList.add('icon-button-small');
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
    .play-card.icon-button,
    .stream-card.icon-button,
    #streamStart.icon-button,
    #streamClear.icon-button,
    #syncToggle.icon-button {
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
    .play-card.icon-button:hover,
    .stream-card.icon-button:hover,
    #streamStart.icon-button:hover,
    #streamClear.icon-button:hover,
    #syncToggle.icon-button:hover {
      background:var(--ink) !important;
      color:#fff !important;
    }
    #syncToggle.icon-button { align-self:center !important; }
    .stream-toolbar .playlist-primary.icon-button {
      border-color:var(--ink) !important;
      background:#fff !important;
      color:var(--ink) !important;
    }
    .stream-toolbar .playlist-primary.icon-button:hover {
      background:var(--ink) !important;
      color:#fff !important;
    }
    .stream-controls .icon-button-small {
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
    .stream-controls .icon-button-small:hover:not(:disabled) {
      background:var(--ink) !important;
      color:#fff !important;
    }
    .stream-controls .icon-button-small:disabled,
    .stream-card:disabled,
    #streamStart:disabled {
      opacity:.28 !important;
      cursor:default !important;
    }
  `;
  document.head.appendChild(style);

  decorate();
})();