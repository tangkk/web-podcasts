(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const STORAGE_KEY = 'web-podcasts:debug-playlist:v2';
  const HLS_JS_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.0/dist/hls.min.js';
  const directory = document.querySelector('#directory');
  const viewTabs = document.querySelector('.view-tabs');
  const favoritesToggle = document.querySelector('#favoritesToggle');
  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  const debugPanel = document.querySelector('#debugPanel');
  const debugToggle = document.querySelector('#debugToggle');
  const debugLog = document.querySelector('#debugLog');
  if (!directory || !viewTabs || !favoritesToggle || !audio || !player) return;

  let queue = [];
  let catalog = null;
  const showCache = new Map();
  let decorating = false;
  let activeHls = null;
  let activeBlobUrl = null;
  let sequential = null;

  const log = (message, detail) => {
    if (!debugLog) return;
    const line = `[PLAYLIST ${new Date().toLocaleTimeString('zh-Hant', {hour12:false})}] ${message}${detail ? ' · ' + JSON.stringify(detail) : ''}`;
    debugLog.textContent += line + '\n';
    debugLog.scrollTop = debugLog.scrollHeight;
  };

  const readQueue = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      queue = Array.isArray(parsed) ? parsed : [];
    } catch { queue = []; }
  };

  const saveQueue = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('debug-playlist-change'));
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
    } catch (error) { log('add failed', {message:error.message}); }
    finally { button.disabled = false; }
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
      <section class="debug-playlist-view">
        <div class="debug-playlist-toolbar">
          <div><strong>播放列表</strong><span>${queue.length} 个单集</span></div>
          <div class="debug-playlist-toolbar-actions">
            <button id="debugPlaylistStart" class="playlist-primary" type="button">开始播放</button>
            <button id="debugPlaylistClear" type="button">清空</button>
          </div>
        </div>
        <div class="debug-playlist-rows">
          ${queue.map((item, index) => `
            <article class="debug-playlist-row" data-queue-key="${esc(item.key)}">
              <div class="debug-playlist-index">${index + 1}</div>
              <div class="debug-playlist-copy">
                <div class="show-name">${esc(item.showName)}</div>
                <div class="episode-title">${esc(item.title)}</div>
              </div>
              <div class="debug-playlist-controls">
                <button type="button" data-action="up" ${index === 0 ? 'disabled' : ''} aria-label="上移">↑</button>
                <button type="button" data-action="down" ${index === queue.length - 1 ? 'disabled' : ''} aria-label="下移">↓</button>
                <button type="button" data-action="remove" aria-label="删除">×</button>
              </div>
            </article>`).join('')}
        </div>
      </section>` : '<div class="empty">播放列表为空。回到“最新单集”或节目页面，点击单集右侧的 + 加入。</div>';
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
    addTab('playlist', '播放列表');
    if (!viewTabs.querySelector('.debug-playlist-sync')) {
      const sync = document.createElement('button');
      sync.className = 'view-tab debug-playlist-sync';
      sync.type = 'button';
      sync.textContent = '同步';
      sync.title = '重新读取本地播放列表';
      viewTabs.appendChild(sync);
    }
    favoritesToggle.hidden = true;
  }

  function makeM3u8(items) {
    const unknown = items.filter(item => !Number.isFinite(item.durationSeconds) || item.durationSeconds <= 0);
    if (unknown.length) throw new Error(`有 ${unknown.length} 个单集缺少可用时长`);
    const target = Math.max(...items.map(item => Math.ceil(item.durationSeconds)));
    const lines = ['#EXTM3U','#EXT-X-VERSION:3',`#EXT-X-TARGETDURATION:${target}`,'#EXT-X-MEDIA-SEQUENCE:0','#EXT-X-PLAYLIST-TYPE:VOD'];
    items.forEach((item, index) => {
      lines.push(`#EXTINF:${item.durationSeconds.toFixed(3)},${item.showName} - ${item.title}`);
      lines.push(item.audio);
      if (index < items.length - 1) lines.push('#EXT-X-DISCONTINUITY');
    });
    lines.push('#EXT-X-ENDLIST');
    return lines.join('\n') + '\n';
  }

  async function ensureHlsJs() {
    if (window.Hls) return window.Hls;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = HLS_JS_URL;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('hls.js load failed'));
      document.head.appendChild(script);
    });
    if (!window.Hls) throw new Error('hls.js unavailable');
    return window.Hls;
  }

  function cleanupPlaylistPlayback() {
    sequential = null;
    activeHls?.destroy();
    activeHls = null;
    if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl = null;
    delete audio.dataset.hlsMock;
  }

  async function startSequential(items, startIndex = 0) {
    cleanupPlaylistPlayback();
    sequential = {items, index:startIndex};
    audio.dataset.hlsMock = '1';
    const playCurrent = async () => {
      const item = sequential?.items[sequential.index];
      if (!item) return;
      player.hidden = false;
      if (nowShow) nowShow.textContent = item.showName;
      if (nowTitle) nowTitle.textContent = item.title;
      audio.src = item.audio;
      audio.load();
      log('desktop sequential fallback', {index:sequential.index, title:item.title});
      await audio.play();
    };
    sequential.playCurrent = playCurrent;
    await playCurrent();
  }

  audio.addEventListener('ended', () => {
    if (!sequential) return;
    if (sequential.index >= sequential.items.length - 1) {
      sequential = null;
      return;
    }
    sequential.index += 1;
    sequential.playCurrent().catch(error => log('sequential advance failed', {message:error.message}));
  });

  async function startDesktopPlaylist(items) {
    const Hls = await ensureHlsJs();
    if (!Hls.isSupported()) return startSequential(items);
    cleanupPlaylistPlayback();
    const text = makeM3u8(items);
    activeBlobUrl = URL.createObjectURL(new Blob([text], {type:'application/vnd.apple.mpegurl'}));
    activeHls = new Hls({enableWorker:true});
    audio.dataset.hlsMock = '1';
    player.hidden = false;
    if (nowShow) nowShow.textContent = '播放列表';
    if (nowTitle) nowTitle.textContent = `${items.length} 个单集 · Desktop HLS`;
    activeHls.attachMedia(audio);
    activeHls.on(Hls.Events.MEDIA_ATTACHED, () => activeHls.loadSource(activeBlobUrl));
    activeHls.on(Hls.Events.MANIFEST_PARSED, () => {
      log('desktop hls.js manifest parsed', {count:items.length});
      audio.play().catch(error => log('desktop hls play rejected', {message:error.message}));
    });
    let fallenBack = false;
    activeHls.on(Hls.Events.ERROR, (_event, data) => {
      log('hls.js error', {type:data.type, details:data.details, fatal:data.fatal});
      if (data.fatal && !fallenBack) {
        fallenBack = true;
        startSequential(items).catch(error => log('fallback failed', {message:error.message}));
      }
    });
  }

  async function startPlaylist() {
    if (!queue.length) return;
    const items = queue.map(item => ({...item}));
    if (debugPanel) debugPanel.hidden = false;
    if (debugToggle) debugToggle.setAttribute('aria-expanded','true');
    const nativeHls = audio.canPlayType('application/vnd.apple.mpegurl');
    const isDesktop = !/iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isDesktop) {
      await startDesktopPlaylist(items);
      return;
    }
    alert('iOS 的自定义播放列表还需要真实 HTTPS m3u8 endpoint；当前 DEBUG 版先验证 UI 和 Desktop 播放。');
    log('iOS playlist start waiting for HTTPS m3u8 endpoint', {nativeHls});
  }

  viewTabs.addEventListener('click', event => {
    const sync = event.target.closest('.debug-playlist-sync');
    if (sync) {
      event.preventDefault();
      event.stopImmediatePropagation();
      readQueue();
      decorateCards();
      if (viewTabs.querySelector('[data-view="playlist"].active')) renderPlaylist();
      const original = sync.textContent;
      sync.textContent = '已同步';
      setTimeout(() => { sync.textContent = original; }, 900);
      return;
    }
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
      event.preventDefault(); event.stopPropagation();
      const card = addButton.closest('.episode[data-show-id][data-episode-id]');
      if (card) toggleCard(card, addButton);
      return;
    }
    if (event.target.closest('#debugPlaylistStart')) {
      startPlaylist().catch(error => { log('playlist start failed', {message:error.message}); alert(`播放失败：${error.message}`); });
      return;
    }
    const rowButton = event.target.closest('.debug-playlist-controls button[data-action]');
    if (rowButton) {
      const row = rowButton.closest('[data-queue-key]');
      const index = queue.findIndex(item => item.key === row?.dataset.queueKey);
      if (index < 0) return;
      const action = rowButton.dataset.action;
      if (action === 'remove') queue.splice(index, 1);
      if (action === 'up' && index > 0) [queue[index - 1], queue[index]] = [queue[index], queue[index - 1]];
      if (action === 'down' && index < queue.length - 1) [queue[index + 1], queue[index]] = [queue[index], queue[index + 1]];
      saveQueue(); renderPlaylist(); return;
    }
    if (event.target.closest('#debugPlaylistClear')) { queue = []; saveQueue(); renderPlaylist(); }
  }, true);

  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    readQueue(); decorateCards();
    if (viewTabs.querySelector('[data-view="playlist"].active')) renderPlaylist();
  });
  window.addEventListener('debug-playlist-change', () => {
    decorateCards();
    if (viewTabs.querySelector('[data-view="playlist"].active')) renderPlaylist();
  });

  const observer = new MutationObserver(mutations => {
    if (!mutations.some(m => [...m.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('.episode') || node.querySelector?.('.episode'))))) return;
    requestAnimationFrame(decorateCards);
  });
  observer.observe(directory, {childList:true, subtree:true});

  const style = document.createElement('style');
  style.textContent = `
    .playlist-add-card{display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid transparent;border-radius:50%;background:#fff;color:var(--muted);font-size:20px;line-height:1;cursor:pointer}
    .playlist-add-card:hover{border-color:var(--line);background:var(--soft);color:var(--ink)}
    .playlist-add-card.is-added{background:var(--ink);color:#fff}
    .debug-playlist-sync{font:inherit}
    .debug-playlist-view{display:grid;gap:12px}
    .debug-playlist-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:10px;border-bottom:1px solid var(--line)}
    .debug-playlist-toolbar>div:first-child{display:flex;align-items:baseline;gap:8px}.debug-playlist-toolbar span{font-size:11px;color:var(--muted)}
    .debug-playlist-toolbar-actions{display:flex;align-items:center;gap:8px}
    .debug-playlist-toolbar button,.debug-playlist-controls button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 10px;cursor:pointer}
    .debug-playlist-toolbar .playlist-primary{border-color:var(--ink);background:var(--ink);color:#fff}
    .debug-playlist-rows{display:grid;gap:0}
    .debug-playlist-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--line)}
    .debug-playlist-index{font-size:11px;color:var(--muted);text-align:center}.debug-playlist-copy{min-width:0}.debug-playlist-copy .episode-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .debug-playlist-controls{display:flex;gap:5px}.debug-playlist-controls button:disabled{opacity:.35}
    @media(max-width:560px){.playlist-add-card{width:30px;height:30px;font-size:18px}.debug-playlist-row{grid-template-columns:24px minmax(0,1fr)}.debug-playlist-controls{grid-column:2;justify-content:flex-start}.debug-playlist-toolbar{align-items:flex-start}.debug-playlist-toolbar-actions{flex-wrap:wrap;justify-content:flex-end}}
  `;
  document.head.appendChild(style);

  readQueue(); ensureTabs(); decorateCards();
})();