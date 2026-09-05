(() => {
  const tabsHost = document.querySelector('.view-tabs');
  const directory = document.querySelector('#directory');
  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  if (!tabsHost || !directory) return;

  let restoring = false;
  let leaving = false;

  const tabs = () => [...tabsHost.querySelectorAll('.view-tab[data-view]')];
  const playlistTab = () => tabsHost.querySelector('.view-tab[data-view="playlist"]');
  const playlistActive = () => !!playlistTab()?.classList.contains('active');
  const streamViewPresent = () => !!directory.querySelector('[data-stream-view="1"], .stream-view, #streamStart');

  function normalizeLabels() {
    const tab = playlistTab();
    if (tab && tab.textContent !== '流') tab.textContent = '流';
    const heading = directory.querySelector('.stream-toolbar strong');
    if (heading && heading.textContent !== '流') heading.textContent = '流';
  }

  function selectOnly(view) {
    tabs().forEach(tab => {
      const active = tab.dataset.view === view;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  function dedupeSyncButtons() {
    const candidates = [...document.querySelectorAll('.viewbar button')].filter(button => {
      if (button.id === 'playbackOrderToggle') return false;
      const text = button.textContent.trim();
      return button.id === 'syncToggle' || button.classList.contains('sync-toggle') || text === '同步' || text === '同步 ✓';
    });
    if (!candidates.length) return;
    const keep = candidates.find(button => button.id === 'syncToggle') || candidates[0];
    candidates.forEach(button => { if (button !== keep) button.remove(); });
  }

  function restorePlaylistIfNeeded() {
    if (leaving || !playlistActive() || restoring) return;
    if (streamViewPresent()) return;
    const tab = playlistTab();
    if (!tab) return;
    restoring = true;
    requestAnimationFrame(() => {
      try {
        if (leaving) return;
        selectOnly('playlist');
        tab.click();
        selectOnly('playlist');
        normalizeLabels();
      } finally {
        restoring = false;
      }
    });
  }

  function leavePlaylist(view) {
    leaving = true;
    document.body.classList.remove('detail-open');
    if (typeof state !== 'undefined') {
      state.detailShow = null;
      if (view === 'favorites') {
        state.view = 'shows';
        state.favoritesOnly = true;
      } else {
        state.view = view;
        state.favoritesOnly = false;
      }
    }

    selectOnly(view);
    if (typeof render === 'function') render();
    selectOnly(view);
    normalizeLabels();

    requestAnimationFrame(() => {
      selectOnly(view);
      leaving = false;
    });
  }

  tabsHost.addEventListener('click', event => {
    const tab = event.target.closest('.view-tab[data-view]');
    if (!tab) return;
    const view = tab.dataset.view;
    const wasPlaylist = playlistActive();

    if (wasPlaylist && view !== 'playlist') {
      event.preventDefault();
      event.stopImmediatePropagation();
      leavePlaylist(view);
      return;
    }

    if (view === 'favorites') {
      event.preventDefault();
      event.stopImmediatePropagation();
      leavePlaylist('favorites');
      return;
    }

    selectOnly(view);
    requestAnimationFrame(() => {
      selectOnly(view);
      normalizeLabels();
    });
  }, true);

  document.addEventListener('click', event => {
    if (event.target.closest('#streamStart')) {
      const wasPlaylist = playlistActive();
      requestAnimationFrame(() => {
        if (wasPlaylist && !leaving) {
          selectOnly('playlist');
          restorePlaylistIfNeeded();
          normalizeLabels();
        }
      });
    }

    if (event.target.closest('#closePlayer') && playlistActive()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      audio?.pause();
      audio?.removeAttribute('src');
      audio?.load();
      if (audio) {
        delete audio.dataset.playlistMode;
        delete audio.dataset.streamHls;
      }
      if (player) player.hidden = true;
      requestAnimationFrame(() => {
        if (leaving) return;
        selectOnly('playlist');
        restorePlaylistIfNeeded();
        normalizeLabels();
      });
    }
  }, true);

  const observer = new MutationObserver(() => {
    if (leaving) return;
    const active = tabs().filter(tab => tab.classList.contains('active'));
    if (active.length > 1) selectOnly(active[active.length - 1].dataset.view);
    dedupeSyncButtons();
    normalizeLabels();
    restorePlaylistIfNeeded();
  });
  observer.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['class','aria-selected']});

  dedupeSyncButtons();
  normalizeLabels();
})();