(() => {
  const audio = document.querySelector('#audio');
  const closeButton = document.querySelector('#closePlayer');
  if (!audio) return;

  const isWholeStreamPlaying = () =>
    (audio.dataset.playlistMode === 'ios-hls' || audio.dataset.playlistMode === 'desktop-sequential') &&
    !audio.paused && !audio.ended;

  function syncLock() {
    const locked = isWholeStreamPlaying();
    const filter = document.querySelector('#streamTitleFilter');
    const minus = document.querySelector('#streamMinus10');
    const plus = document.querySelector('#streamPlus10');

    if (filter) {
      filter.disabled = locked;
      filter.title = locked ? '播放流时不能修改筛选' : '';
    }

    if (minus) {
      if (locked) {
        minus.disabled = true;
        minus.title = '播放流时不能修改流';
      }
    }

    if (plus) {
      if (locked) {
        plus.disabled = true;
        plus.title = '播放流时不能修改流';
      }
    }

    if (!locked) {
      window.dispatchEvent(new CustomEvent('stream-config-unlocked'));
    }
  }

  document.addEventListener('input', event => {
    if (!event.target.closest?.('#streamTitleFilter') || !isWholeStreamPlaying()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('click', event => {
    const control = event.target.closest?.('#streamMinus10, #streamPlus10');
    if (!control || !isWholeStreamPlaying()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  ['play', 'playing', 'pause', 'ended', 'emptied', 'abort'].forEach(type => {
    audio.addEventListener(type, () => requestAnimationFrame(syncLock));
  });

  closeButton?.addEventListener('click', () => {
    requestAnimationFrame(() => requestAnimationFrame(syncLock));
  });

  window.addEventListener('stream-change', () => requestAnimationFrame(syncLock));
  window.addEventListener('stream-filter-change', () => requestAnimationFrame(syncLock));
  window.addEventListener('stream-config-unlocked', () => {
    const minus = document.querySelector('#streamMinus10');
    const plus = document.querySelector('#streamPlus10');
    const queue = (() => {
      try {
        const value = JSON.parse(localStorage.getItem('web-podcasts:stream:v1') || '[]');
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      }
    })();
    if (minus) minus.disabled = queue.length <= 1;
    if (plus) plus.disabled = queue.length >= 100;
  });

  const observer = new MutationObserver(mutations => {
    const relevant = mutations.some(m => [...m.addedNodes].some(node =>
      node.nodeType === 1 && (
        node.matches?.('#streamTitleFilter, #streamMinus10, #streamPlus10, .stream-filter-bar') ||
        node.querySelector?.('#streamTitleFilter, #streamMinus10, #streamPlus10')
      )
    ));
    if (relevant) requestAnimationFrame(syncLock);
  });
  observer.observe(document.body, {subtree:true, childList:true});

  syncLock();
})();
