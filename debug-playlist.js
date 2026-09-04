(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const STORAGE_KEY = 'web-podcasts:debug-playlist:v1';
  const CHANNEL_NAME = 'web-podcasts-debug-playlist';
  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  const directory = document.querySelector('#directory');
  const debugPanel = document.querySelector('#debugPanel');
  const debugToggle = document.querySelector('#debugToggle');
  const debugLog = document.querySelector('#debugLog');
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  if (!audio || !directory) return;

  let queue = [];
  let catalog = null;
  let showCache = new Map();
  let channel = null;

  const log = (message, detail) => {
    if (!debugLog) return;
    const line = `[PLAYLIST LAB ${new Date().toLocaleTimeString('zh-Hant', {hour12:false})}] ${message}${detail ? ' · ' + JSON.stringify(detail) : ''}`;
    debugLog.textContent += line + '\n';
    debugLog.scrollTop = debugLog.scrollHeight;
  };

  const parseDuration = value => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parts = String(value || '').split(':').map(Number);
    if (!parts.length || parts.some(Number.isNaN)) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return null;
  };

  const escapeHtml = value => String(value || '').replace(/[&<>\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]));

  const persist = (broadcast = true) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    if (broadcast) channel?.postMessage({type:'queue', queue});
    renderQueue();
    decorateEpisodeButtons();
  };

  const loadStored = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      queue = Array.isArray(parsed) ? parsed : [];
    } catch {
      queue = [];
    }
  };

  const style = document.createElement('style');
  style.textContent = `
    .debug-playlist-lab{border:1px solid #111;border-radius:12px;padding:14px;margin:0 0 14px;background:#fafafa}
    .debug-playlist-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .debug-playlist-kicker{font-size:10px;font-weight:800;letter-spacing:.08em;color:#e4332a}
    .debug-playlist-actions{display:flex;gap:8px;flex-wrap:wrap}
    .debug-playlist-actions button,.queue-row button,.add-to-playlist{border:1px solid #222;background:#fff;border-radius:999px;padding:6px 10px;cursor:pointer;font:inherit}
    .debug-playlist-actions button:disabled{opacity:.45;cursor:not-allowed}
    .debug-playlist-meta{font-size:11px;color:#666;margin-top:4px}
    .debug-playlist-list{display:grid;gap:8px;margin-top:12px}
    .queue-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border-top:1px solid #ddd;padding-top:8px}
    .queue-row:first-child{border-top:0;padding-top:0}
    .queue-copy{min-width:0}
    .queue-show{font-size:10px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .queue-title{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .queue-controls{display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
    .queue-index{font-variant-numeric:tabular-nums;color:#777;font-size:11px}
    .add-to-playlist{margin-top:6px;padding:5px 8px;font-size:11px}
    .add-to-playlist.is-added{background:#111;color:#fff}
    @media(max-width:560px){.queue-row{grid-template-columns:1fr}.queue-controls{justify-content:flex-start}.debug-playlist-actions{width:100%}.debug-playlist-actions button{flex:1}}
  `;
  document.head.appendChild(style);

  const section = document.createElement('section');
  section.className = 'debug-playlist-lab';
  section.innerHTML = `
    <div class="debug-playlist-head">
      <div>
        <div class="debug-playlist-kicker">DEBUG · PLAYLIST LAB V1</div>
        <strong>播放列表 = 播放前一次性固化的 HLS 源</strong>
        <div class="debug-playlist-meta">本地持久化 + 标签页同步；顺序可调整、单项可删除、可一键清空。播放时整份列表先生成 m3u8，再交给同一个 &lt;audio&gt;。</div>
      </div>
      <div class="debug-playlist-actions">
        <button id="debugPlaylistPlay" type="button">播放整个列表</button>
        <button id="debugPlaylistClear" type="button">清空列表</button>
      </div>
    </div>
    <div id="debugPlaylistStatus" class="debug-playlist-meta"></div>
    <div id="debugPlaylistList" class="debug-playlist-list"></div>
  `;
  directory.parentNode.insertBefore(section, directory);

  const listEl = section.querySelector('#debugPlaylistList');
  const statusEl = section.querySelector('#debugPlaylistStatus');
  const playButton = section.querySelector('#debugPlaylistPlay');
  const clearButton = section.querySelector('#debugPlaylistClear');

  function renderQueue() {
    statusEl.textContent = queue.length ? `${queue.length} 个单集 · 点击播放前会固化为一个 VOD m3u8` : '播放列表为空';
    playButton.disabled = queue.length === 0;
    clearButton.disabled = queue.length === 0;
    listEl.innerHTML = queue.length ? queue.map((item, index) => `
      <div class="queue-row" data-queue-id="${escapeHtml(item.key)}">
        <div class="queue-copy">
          <div class="queue-show">${escapeHtml(item.showName)}</div>
          <div class="queue-title">${escapeHtml(item.title)}</div>
        </div>
        <div class="queue-controls">
          <span class="queue-index">${index + 1}/${queue.length}</span>
          <button type="button" data-action="up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-action="down" ${index === queue.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" data-action="remove">删除</button>
        </div>
      </div>
    `).join('') : '';
  }

  listEl.addEventListener('click', event => {
    const row = event.target.closest('[data-queue-id]');
    const button = event.target.closest('button[data-action]');
    if (!row || !button) return;
    const index = queue.findIndex(item => item.key === row.dataset.queueId);
    if (index < 0) return;
    if (button.dataset.action === 'remove') queue.splice(index, 1);
    if (button.dataset.action === 'up' && index > 0) [queue[index - 1], queue[index]] = [queue[index], queue[index - 1]];
    if (button.dataset.action === 'down' && index < queue.length - 1) [queue[index + 1], queue[index]] = [queue[index], queue[index + 1]];
    persist();
  });

  clearButton.addEventListener('click', () => {
    queue = [];
    persist();
    log('playlist cleared');
  });

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
      publisher: show.publisher,
      artwork: show.artwork,
      title: episode.title,
      audio: episode.audio,
      duration: episode.duration,
      durationSeconds: parseDuration(episode.duration)
    };
  }

  async function addFromCard(card) {
    const showId = card.dataset.showId;
    const episodeId = card.dataset.episodeId;
    if (!showId || !episodeId) return;
    const key = `${showId}:${episodeId}`;
    if (queue.some(item => item.key === key)) return;
    try {
      const item = await resolveEpisode(showId, episodeId);
      queue.push(item);
      persist();
      log('episode added to playlist', {show:item.showName, title:item.title, duration:item.duration});
    } catch (error) {
      log('playlist add failed', {showId, episodeId, message:error.message});
    }
  }

  function decorateEpisodeButtons() {
    document.querySelectorAll('.episode[data-show-id][data-episode-id]').forEach(card => {
      const key = `${card.dataset.showId}:${card.dataset.episodeId}`;
      let button = card.querySelector('.add-to-playlist');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'add-to-playlist';
        const actions = card.querySelector('.card-actions') || card;
        actions.appendChild(button);
        button.addEventListener('click', event => {
          event.stopPropagation();
          if (queue.some(item => item.key === key)) {
            queue = queue.filter(item => item.key !== key);
            persist();
            log('episode removed from playlist', {key});
          } else {
            addFromCard(card);
          }
        });
      }
      const added = queue.some(item => item.key === key);
      button.textContent = added ? '✓ 已加入列表' : '＋ 加入播放列表';
      button.classList.toggle('is-added', added);
    });
  }

  const observer = new MutationObserver(() => decorateEpisodeButtons());
  observer.observe(directory, {childList:true, subtree:true});

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker unsupported');
    const registration = await navigator.serviceWorker.register('./debug-playlist-sw.js?v=1', {scope:'./'});
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        const onChange = () => { navigator.serviceWorker.removeEventListener('controllerchange', onChange); resolve(); };
        navigator.serviceWorker.addEventListener('controllerchange', onChange);
        setTimeout(() => { navigator.serviceWorker.removeEventListener('controllerchange', onChange); resolve(); }, 3000);
      });
    }
    return registration;
  }

  function makeM3u8(items) {
    const unknown = items.filter(item => !Number.isFinite(item.durationSeconds) || item.durationSeconds <= 0);
    if (unknown.length) throw new Error(`有 ${unknown.length} 个单集缺少可用时长`);
    const target = Math.max(...items.map(item => Math.ceil(item.durationSeconds)));
    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${target}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PLAYLIST-TYPE:VOD'
    ];
    items.forEach((item, index) => {
      lines.push(`#EXTINF:${item.durationSeconds.toFixed(3)},${item.showName} - ${item.title}`);
      lines.push(item.audio);
      if (index < items.length - 1) lines.push('#EXT-X-DISCONTINUITY');
    });
    lines.push('#EXT-X-ENDLIST');
    return lines.join('\n') + '\n';
  }

  async function publishPlaylistToServiceWorker(text) {
    await registerServiceWorker();
    const worker = navigator.serviceWorker.controller || (await navigator.serviceWorker.ready).active;
    if (!worker) throw new Error('Service Worker not active');
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => reject(new Error('Service Worker playlist publish timeout')), 5000);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        if (event.data?.ok) resolve(event.data.url);
        else reject(new Error('Service Worker rejected playlist'));
      };
      worker.postMessage({type:'SET_DEBUG_PLAYLIST', text}, [channel.port2]);
    });
  }

  playButton.addEventListener('click', async () => {
    if (!queue.length) return;
    try {
      const frozen = queue.map(item => ({...item}));
      const text = makeM3u8(frozen);
      const url = await publishPlaylistToServiceWorker(text);
      audio.dataset.hlsMock = '1';
      player.hidden = false;
      if (debugPanel) debugPanel.hidden = false;
      if (debugToggle) debugToggle.setAttribute('aria-expanded','true');
      if (nowShow) nowShow.textContent = 'PLAYLIST LAB V1';
      if (nowTitle) nowTitle.textContent = `${frozen.length} episodes / frozen HLS playlist`;
      const source = `${url}?v=${Date.now()}`;
      audio.src = source;
      audio.load();
      log('playlist frozen into HLS', {count:frozen.length, source, canPlayHls:audio.canPlayType('application/vnd.apple.mpegurl')});
      await audio.play();
      log('playlist HLS play started', {currentSrc:audio.currentSrc});
    } catch (error) {
      log('playlist HLS play failed', {name:error?.name, message:error?.message});
      alert(`播放列表 HLS 测试失败：${error?.message || error}`);
    }
  });

  loadStored();
  try {
    channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
    if (channel) {
      channel.onmessage = event => {
        if (event.data?.type !== 'queue' || !Array.isArray(event.data.queue)) return;
        queue = event.data.queue;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
        renderQueue();
        decorateEpisodeButtons();
      };
    }
  } catch {}

  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    loadStored();
    renderQueue();
    decorateEpisodeButtons();
  });

  renderQueue();
  decorateEpisodeButtons();
  log('PLAYLIST LAB V1 ready', {storedItems:queue.length});
})();
