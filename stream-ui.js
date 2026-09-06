(() => {
  const STORAGE_KEY = 'web-podcasts:stream:v1';
  const directory = document.querySelector('#directory');
  const viewTabs = document.querySelector('.view-tabs');
  const favoritesToggle = document.querySelector('#favoritesToggle');
  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  if (!directory || !viewTabs || !favoritesToggle || !audio || !player) return;

  let queue = [];
  let catalog = null;
  const showCache = new Map();
  let decorating = false;
  let sequential = null;

  const readQueue = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      queue = Array.isArray(parsed) ? parsed : [];
    } catch { queue = []; }
  };

  const saveQueue = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('stream-change'));
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const parseDuration = value => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parts = String(value || '').split(':').map(Number);
    if (!parts.length || parts.some(Number.isNaN)) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
  };

  async function loadCatalog() {
    if (catalog) return catalog;
    const response = await fetch('./episodes.json', {cache:'no-store'});
    if (!response.ok) throw new Error(`catalog HTTP ${response.status}`);
    catalog = await response.json();
    return catalog;
  }

  async function resolveEpisode(showId, episodeId) {
    const data = await loadCatalog();
    let show = data.shows.find(item => item.id === showId);
    let episode = show?.episodes?.find(item => item.id === episodeId);
    if (!episode) {
      if (!showCache.has(showId)) {
        const response = await fetch(`./shows/${encodeURIComponent(showId)}.json`, {cache:'no-store'});
        if (!response.ok) throw new Error(`show HTTP ${response.status}`);
        showCache.set(showId, await response.json());
      }
      show = showCache.get(showId);
      episode = show?.episodes?.find(item => item.id === episodeId);
    }
    if (!show || !episode) throw new Error('episode not found');
    return {
      key: `${show.id}:${episode.id}`,
      showId: show.id,
      episodeId: episode.id,
      showName: show.name,
      title: episode.title,
      audio: episode.audio,
      duration: episode.duration,
      durationSeconds: parseDuration(episode.duration)
    };
  }

  function isAdded(key) { return queue.some(item => item.key === key); }

  function updateAddButton(button, added) {
    const nextText = added ? '✓' : '+';
    if (button.textContent !== nextText) button.textContent = nextText;
    if (button.classList.contains('is-added') !== added) button.classList.toggle('is-added', added);
    button.setAttribute('aria-label', added ? '从播放列表移除' : '加入播放列表');
    button.title = added ? '从播放列表移除' : '加入播放列表';
  }

  function decorateCards() {
    if (decorating) return;
    decorating = true;
    try {
      document.querySelectorAll('.episode[data-show-id][data-episode-id]').forEach(card => {
        const key = `${card.dataset.showId}:${card.dataset.episodeId}`;
        let button = card.querySelector('.playlist-add-card');
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.className = 'playlist-add-card';
          const actions = card.querySelector('.card-actions');
          if (!actions) return;
          const download = actions.querySelector('.download-card');
          if (download) actions.insertBefore(button, download);
          else actions.appendChild(button);
        }
        updateAddButton(button, isAdded(key));
      });
    } finally { decorating = false; }
  }

  async function toggleCard(card, button) {
    const key = `${card.dataset.showId}:${card.dataset.episodeId}`;
    if (isAdded(key)) {
      queue = queue.filter(item => item.key !== key);
      saveQueue();
      updateAddButton(button, false);
      return;
    }
    button.disabled = true;
    try {
      const item = await resolveEpisode(card.dataset.showId, card.dataset.episodeId);
      if (!isAdded(item.key)) queue.push(item);
      saveQueue();
      updateAddButton(button, true);
    } catch (error) {
      console.warn('Playlist add failed', error);
    } finally {
      button.disabled = false;
    }
  }

  function setActiveTab(name) {
    viewTabs.querySelectorAll('.view-tab[data-view]').forEach(tab => {
      const active = tab.dataset.view === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  function renderPlaylist() {
    document.body.classList.remove('detail-open');
    setActiveTab('playlist');
    const resultCount = document.querySelector('#resultCount');
    if (resultCount) resultCount.textContent = `${queue.length} 个播放列表单集`;
    directory.innerHTML = queue.length ? `
      <section class="stream-view" data-stream-view="1">
        <div class="stream-toolbar">
          <div><strong>流</strong><span>${queue.length} 个单集</span></div>
          <div class="stream-toolbar-actions">
            <button id="streamStart" class="playlist-primary" type="button">开始播放</button>
            <button id="streamClear" type="button">清空</button>
          </div>
        </div>
        <div class="stream-rows">
          ${queue.map((item, index) => `
            <article class="stream-row" data-queue-key="${esc(item.key)}">
              <div class="stream-index">${index + 1}</div>
              <div class="stream-copy">
                <div class="show-name">${esc(item.showName)}</div>
                <div class="episode-title">${esc(item.title)}</div>
              </div>
              <div class="stream-controls">
                <button type="button" data-action="up" ${index === 0 ? 'disabled' : ''} aria-label="上移">↑</button>
                <button type="button" data-action="down" ${index === queue.length - 1 ? 'disabled' : ''} aria-label="下移">↓</button>
                <button type="button" data-action="remove" aria-label="删除">×</button>
              </div>
            </article>`).join('')}
        </div>
      </section>` : '<section class="stream-view empty" data-stream-view="1">流为空。回到“最新单集”或节目页面，点击单集右侧的 + 加入。</section>';
  }

  function ensureTabs() {
    const addTab = (view, label) => {
      if (viewTabs.querySelector(`[data-view="${view}"]`)) return;
      const tab = document.createElement('button');
      tab.className = 'view-tab';
      tab.dataset.view = view;
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', 'false');
      tab.textContent = label;
      viewTabs.appendChild(tab);
    };
    addTab('favorites', '收藏');
    addTab('playlist', '流');
    favoritesToggle.hidden = true;
  }

  function cleanupPlaylistPlayback() {
    sequential = null;
    delete audio.dataset.streamHls;
    delete audio.dataset.playlistMode;
  }

  async function startDesktopSequential(items, startIndex = 0) {
    cleanupPlaylistPlayback();
    sequential = {items, index:startIndex};
    audio.dataset.playlistMode = 'desktop-sequential';

    const playCurrent = async () => {
      const state = sequential;
      const item = state?.items[state.index];
      if (!item) return;
      player.hidden = false;
      if (nowShow) nowShow.textContent = item.showName;
      if (nowTitle) nowTitle.textContent = item.title;
      audio.src = item.audio;
      audio.load();
      await audio.play();
    };

    sequential.playCurrent = playCurrent;
    await playCurrent();
  }

  audio.addEventListener('ended', () => {
    if (!sequential) return;
    if (sequential.index >= sequential.items.length - 1) {
      sequential = null;
      delete audio.dataset.playlistMode;
      return;
    }
    sequential.index += 1;
    sequential.playCurrent().catch(error => console.warn('Desktop sequential advance failed', error));
  });

  function isIOSFamily() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }

  async function startIOSPlaylist() {
    alert('iOS 播放列表正在由原生 HLS 播放器接管。');
  }

  async function startPlaylist() {
    if (!queue.length) return;
    const items = queue.map(item => ({...item}));
    if (isIOSFamily()) {
      await startIOSPlaylist(items);
      return;
    }
    await startDesktopSequential(items);
  }

  viewTabs.addEventListener('click', event => {
    const tab = event.target.closest('.view-tab[data-view]');
    if (!tab) return;
    if (tab.dataset.view === 'favorites') {
      event.preventDefault();
      if (favoritesToggle.getAttribute('aria-pressed') !== 'true') favoritesToggle.click();
      setActiveTab('favorites');
      return;
    }
    if (tab.dataset.view === 'playlist') {
      event.preventDefault();
      if (favoritesToggle.getAttribute('aria-pressed') === 'true') favoritesToggle.click();
      renderPlaylist();
      return;
    }
    if (favoritesToggle.getAttribute('aria-pressed') === 'true') favoritesToggle.click();
  }, true);

  document.addEventListener('click', event => {
    const addButton = event.target.closest('.playlist-add-card');
    if (addButton) {
      event.preventDefault();
      event.stopPropagation();
      const card = addButton.closest('.episode[data-show-id][data-episode-id]');
      if (card) toggleCard(card, addButton);
      return;
    }

    if (event.target.closest('#streamStart')) {
      startPlaylist().catch(error => {
        console.warn('Playlist start failed', error);
        alert(`播放失败：${error.message}`);
      });
      return;
    }

    const rowButton = event.target.closest('.stream-controls button[data-action]');
    if (rowButton) {
      const row = rowButton.closest('[data-queue-key]');
      const index = queue.findIndex(item => item.key === row?.dataset.queueKey);
      if (index < 0) return;
      const action = rowButton.dataset.action;
      if (action === 'remove') queue.splice(index, 1);
      if (action === 'up' && index > 0) [queue[index - 1], queue[index]] = [queue[index], queue[index - 1]];
      if (action === 'down' && index < queue.length - 1) [queue[index + 1], queue[index]] = [queue[index], queue[index + 1]];
      saveQueue();
      renderPlaylist();
      return;
    }

    if (event.target.closest('#streamClear')) {
      queue = [];
      saveQueue();
      renderPlaylist();
    }
  }, true);

  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    readQueue();
    decorateCards();
    if (viewTabs.querySelector('[data-view="playlist"].active')) renderPlaylist();
  });

  window.addEventListener('stream-change', () => {
    readQueue();
    decorateCards();
    if (viewTabs.querySelector('[data-view="playlist"].active')) renderPlaylist();
  });

  const observer = new MutationObserver(mutations => {
    if (!mutations.some(m => [...m.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('.episode') || node.querySelector?.('.episode'))))) return;
    requestAnimationFrame(decorateCards);
  });
  observer.observe(directory, {childList:true,subtree:true});

  const style = document.createElement('style');
  style.textContent = `
    .playlist-add-card{display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid transparent;border-radius:50%;background:#fff;color:var(--muted);font-size:20px;line-height:1;cursor:pointer}
    .playlist-add-card:hover{border-color:var(--line);background:var(--soft);color:var(--ink)}
    .playlist-add-card.is-added{background:var(--ink);color:#fff}
    .stream-view{display:grid;gap:12px}
    .stream-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:10px;border-bottom:1px solid var(--line)}
    .stream-toolbar>div:first-child{display:flex;align-items:baseline;gap:8px}.stream-toolbar span{font-size:11px;color:var(--muted)}
    .stream-toolbar-actions{display:flex;align-items:center;gap:8px}
    .stream-toolbar button,.stream-controls button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 10px;cursor:pointer}
    .stream-toolbar .playlist-primary{border-color:var(--ink);background:var(--ink);color:#fff}
    .stream-rows{display:grid;gap:0}
    .stream-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--line)}
    .stream-index{font-size:11px;color:var(--muted);text-align:center}.stream-copy{min-width:0}.stream-copy .episode-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .stream-controls{display:flex;gap:5px}.stream-controls button:disabled{opacity:.35}
    @media(max-width:560px){.playlist-add-card{width:30px;height:30px;font-size:18px}.stream-row{grid-template-columns:24px minmax(0,1fr)}.stream-controls{grid-column:2;justify-content:flex-start}.stream-toolbar{align-items:flex-start}.stream-toolbar-actions{flex-wrap:wrap;justify-content:flex-end}}
  `;
  document.head.appendChild(style);

  readQueue();
  ensureTabs();
  decorateCards();
})();