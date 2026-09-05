(() => {
  const STORAGE_KEY = 'web-podcasts:stream:v1';
  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  const directory = document.querySelector('#directory');
  const artwork = document.querySelector('#playerArtwork');
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  if (!audio || !player || !directory) return;

  const ua = navigator.userAgent || '';
  const isIOSFamily = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const readItems = () => {
    try {
      const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  };

  const currentItem = key => readItems().find(item => item.key === key) || null;

  const sameSrc = url => {
    if (!url) return false;
    try {
      return new URL(audio.currentSrc || audio.src, location.href).href === new URL(url, location.href).href;
    } catch {
      return (audio.currentSrc || audio.src) === url;
    }
  };

  const streamMode = () =>
    audio.dataset.playlistMode === 'ios-hls' ||
    audio.dataset.playlistMode === 'desktop-sequential';

  const singleMode = () => audio.dataset.playlistMode === 'stream-single';
  const singlePlaying = () => singleMode() && !audio.paused && !audio.ended;

  function updatePlayer(item) {
    player.hidden = false;
    if (artwork) artwork.src = item.artwork || '';
    if (nowShow) nowShow.textContent = item.showName || '';
    if (nowTitle) nowTitle.textContent = item.title || '';
    if (typeof state !== 'undefined') state.current = {showId:item.showId, episodeId:item.episodeId};
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.title || '',
        artist: item.showName || '',
        album: item.publisher || '',
        artwork: item.artwork ? [{src:item.artwork}] : []
      });
    }
  }

  function ensureEpisodeButtons() {
    document.querySelectorAll('.stream-row[data-queue-key]').forEach(row => {
      const controls = row.querySelector('.stream-controls');
      if (!controls) return;
      let button = controls.querySelector('.stream-episode-play');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'stream-episode-play icon-button-small';
        button.setAttribute('aria-label', '从本集开始播放流');
        button.title = '从本集开始播放流';
        controls.insertBefore(button, controls.firstChild);
      }
    });
    syncState();
  }

  function syncState() {
    const isSinglePlaying = singlePlaying();
    const start = document.querySelector('#streamStart');

    if (start) {
      start.disabled = isSinglePlaying;
      if (isSinglePlaying) {
        start.title = '正在播放单集，请先暂停单集';
        start.setAttribute('aria-label', '正在播放单集，请先暂停单集');
      } else if (streamMode() && !audio.paused && !audio.ended) {
        start.title = '暂停流';
        start.setAttribute('aria-label', '暂停流');
      } else if (streamMode()) {
        start.title = '继续播放流';
        start.setAttribute('aria-label', '继续播放流');
      } else {
        start.title = '开始播放流';
        start.setAttribute('aria-label', '开始播放流');
      }
    }

    document.querySelectorAll('.stream-episode-play').forEach(button => {
      button.disabled = false;
      button.textContent = '▶';
      button.setAttribute('aria-label', '从本集开始播放流');
      button.title = '从本集开始播放流';
    });
  }

  function syncAfterEvent() {
    requestAnimationFrame(() => requestAnimationFrame(syncState));
  }

  async function toggleSingle(item) {
    if (isIOSFamily || !item) return;

    if (singleMode() && sameSrc(item.audio)) {
      if (audio.paused || audio.ended) await audio.play();
      else audio.pause();
      return;
    }

    delete audio.dataset.streamHls;
    audio.dataset.playlistMode = 'stream-single';
    updatePlayer(item);
    audio.src = item.audio;
    audio.load();
    await audio.play();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.stream-episode-play');
    if (button && !button.disabled) {
      if (isIOSFamily) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const row = button.closest('.stream-row[data-queue-key]');
      const key = row?.dataset.queueKey;
      if (!key) return;
      window.dispatchEvent(new CustomEvent('web-podcasts:desktop-stream-seek', {detail:{key}}));
      return;
    }

    if (event.target.closest('#closePlayer')) {
      setTimeout(() => {
        delete audio.dataset.playlistMode;
        delete audio.dataset.streamHls;
        syncState();
      }, 0);
    }
  }, true);

  ['play','playing','pause','loadedmetadata','ended','emptied','abort'].forEach(type => {
    audio.addEventListener(type, syncAfterEvent);
  });

  audio.addEventListener('ended', () => {
    if (singleMode()) delete audio.dataset.playlistMode;
    syncAfterEvent();
  });

  window.addEventListener('stream-change', () => requestAnimationFrame(ensureEpisodeButtons));

  const observer = new MutationObserver(mutations => {
    if (!mutations.some(m => [...m.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('.stream-row') || node.querySelector?.('.stream-row'))))) return;
    requestAnimationFrame(ensureEpisodeButtons);
  });
  observer.observe(directory, {subtree:true, childList:true});

  const style = document.createElement('style');
  style.textContent = `
    #streamStart:disabled {
      opacity:.28 !important;
      cursor:default !important;
      pointer-events:none !important;
    }
  `;
  document.head.appendChild(style);

  ensureEpisodeButtons();
})();
