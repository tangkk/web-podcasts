(() => {
  const audio = document.querySelector('#audio');
  const closeButton = document.querySelector('#closePlayer');
  if (!audio) return;

  const ua = navigator.userAgent || '';
  const isIOSFamily = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isWholeStreamPlaying = () =>
    (audio.dataset.playlistMode === 'ios-hls' || audio.dataset.playlistMode === 'desktop-sequential') &&
    !audio.paused && !audio.ended;

  function readQueue() {
    try {
      const value = JSON.parse(localStorage.getItem('web-podcasts:stream:v1') || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function syncRowControls(locked) {
    const rows = [...document.querySelectorAll('.stream-row[data-queue-key]')];
    rows.forEach((row, index) => {
      row.querySelectorAll('.stream-controls button').forEach(button => {
        const episodeSeek = isIOSFamily && audio.dataset.playlistMode === 'ios-hls' && button.classList.contains('stream-episode-play');

        if (locked && !episodeSeek) {
          button.disabled = true;
          button.title = '播放流时不能修改单集';
          return;
        }

        if (button.classList.contains('stream-episode-play')) {
          button.disabled = false;
          button.title = isIOSFamily ? '从本集开始播放流' : '播放本集';
          return;
        }

        const action = button.dataset.action;
        if (action === 'up') button.disabled = index === 0;
        else if (action === 'down') button.disabled = index === rows.length - 1;
        else button.disabled = false;
        button.title = '';
      });
    });
  }

  function syncLock() {
    const locked = isWholeStreamPlaying();
    const filter = document.querySelector('#streamTitleFilter');
    const minus = document.querySelector('#streamMinus10');
    const plus = document.querySelector('#streamPlus10');
    const queue = readQueue();

    if (filter) {
      filter.disabled = locked;
      filter.title = locked ? '播放流时不能修改筛选' : '';
    }

    if (minus) {
      minus.disabled = locked || queue.length <= 1;
      minus.title = locked ? '播放流时不能修改流' : (queue.length <= 1 ? '流至少保留 1 集' : '减少最多 10 集');
    }

    if (plus) {
      plus.disabled = locked || queue.length >= 100;
      plus.title = locked ? '播放流时不能修改流' : (queue.length >= 100 ? '流最多 100 集' : '增加最多 10 集');
    }

    syncRowControls(locked);
  }

  document.addEventListener('input', event => {
    if (!event.target.closest?.('#streamTitleFilter') || !isWholeStreamPlaying()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('click', event => {
    const control = event.target.closest?.('#streamMinus10, #streamPlus10, .stream-row .stream-controls button');
    if (!control || !isWholeStreamPlaying()) return;
    if (isIOSFamily && audio.dataset.playlistMode === 'ios-hls' && control.classList.contains('stream-episode-play')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  ['play', 'playing', 'pause', 'ended', 'emptied', 'abort'].forEach(type => {
    audio.addEventListener(type, () => requestAnimationFrame(() => requestAnimationFrame(syncLock)));
  });

  closeButton?.addEventListener('click', () => {
    requestAnimationFrame(() => requestAnimationFrame(syncLock));
  });

  window.addEventListener('stream-change', () => requestAnimationFrame(syncLock));
  window.addEventListener('stream-filter-change', () => requestAnimationFrame(syncLock));

  const observer = new MutationObserver(mutations => {
    const relevant = mutations.some(m => [...m.addedNodes].some(node =>
      node.nodeType === 1 && (
        node.matches?.('#streamTitleFilter, #streamMinus10, #streamPlus10, .stream-filter-bar, .stream-row, .stream-controls') ||
        node.querySelector?.('#streamTitleFilter, #streamMinus10, #streamPlus10, .stream-row, .stream-controls')
      )
    ));
    if (relevant) requestAnimationFrame(syncLock);
  });
  observer.observe(document.body, {subtree:true, childList:true});

  syncLock();
})();