(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const tabsHost = document.querySelector('.view-tabs');
  const directory = document.querySelector('#directory');
  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  if (!tabsHost || !directory) return;

  let restoring = false;

  const tabs = () => [...tabsHost.querySelectorAll('.view-tab[data-view]')];
  const playlistTab = () => tabsHost.querySelector('.view-tab[data-view="playlist"]');
  const playlistActive = () => !!playlistTab()?.classList.contains('active');

  function selectOnly(view) {
    tabs().forEach(tab => {
      const active = tab.dataset.view === view;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  function dedupeSyncButtons() {
    const candidates = [...document.querySelectorAll('.viewbar button')].filter(button => {
      const text = button.textContent.trim();
      return button.id === 'syncToggle' || button.classList.contains('sync-toggle') || button.classList.contains('debug-playlist-sync') || text === '同步' || text === '同步 ✓';
    });
    if (!candidates.length) return;
    const keep = candidates.find(button => button.id === 'syncToggle') || candidates[0];
    candidates.forEach(button => { if (button !== keep) button.remove(); });
  }

  function restorePlaylistIfNeeded() {
    if (!playlistActive() || restoring) return;
    if (directory.querySelector('.debug-playlist-view') || directory.querySelector('#debugPlaylistStart')) return;
    const tab = playlistTab();
    if (!tab) return;
    restoring = true;
    requestAnimationFrame(() => {
      try {
        selectOnly('playlist');
        tab.click();
        selectOnly('playlist');
      } finally {
        restoring = false;
      }
    });
  }

  tabsHost.addEventListener('click', event => {
    const tab = event.target.closest('.view-tab[data-view]');
    if (!tab) return;
    const view = tab.dataset.view;
    selectOnly(view);
    requestAnimationFrame(() => selectOnly(view));
  }, true);

  document.addEventListener('click', event => {
    if (event.target.closest('#debugPlaylistStart')) {
      const wasPlaylist = playlistActive();
      requestAnimationFrame(() => {
        if (wasPlaylist) {
          selectOnly('playlist');
          restorePlaylistIfNeeded();
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
        delete audio.dataset.hlsMock;
      }
      if (player) player.hidden = true;
      requestAnimationFrame(() => {
        selectOnly('playlist');
        restorePlaylistIfNeeded();
      });
    }
  }, true);

  const observer = new MutationObserver(() => {
    const active = tabs().filter(tab => tab.classList.contains('active'));
    if (active.length > 1) selectOnly(active[active.length - 1].dataset.view);
    dedupeSyncButtons();
    restorePlaylistIfNeeded();
  });
  observer.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['class','aria-selected']});

  dedupeSyncButtons();
})();
