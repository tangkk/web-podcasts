(() => {
  const STORAGE_KEY = 'web-podcasts:recents';
  const STREAM_STORAGE_KEY = 'web-podcasts:stream:v1';
  const STREAM_FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const MAX_RECENTS = 10;
  const SAVE_INTERVAL_MS = 5000;
  const MIN_RESUME_SECONDS = 5;
  const END_GUARD_SECONDS = 15;
  let lastProgressSaveAt = 0;
  let restoringRecent = false;

  const escapeHtml = value => String(value || '').replace(/[&<>'\"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;'
  }[char]));
  const normalize = value => String(value || '').toLocaleLowerCase().normalize('NFKC').trim();

  function loadRecents() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.slice(0, MAX_RECENTS) : [];
    } catch {
      return [];
    }
  }

  function saveRecents(recents) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  function progressLabel(item) {
    const progress = Number(item.progressSeconds) || 0;
    const duration = Number(item.mediaDurationSeconds) || 0;
    if (progress < MIN_RESUME_SECONDS) return '';
    return duration > 0
      ? `續播 ${formatTime(progress)} / ${formatTime(duration)}`
      : `續播 ${formatTime(progress)}`;
  }

  function renderRecents() {
    const section = document.querySelector('#recentSection');
    const list = document.querySelector('#recentList');
    if (!section || !list) return;

    const recents = loadRecents();
    section.hidden = recents.length === 0;
    list.innerHTML = recents.map((item, index) => {
      const progress = progressLabel(item);
      const isStream = item.kind === 'stream';
      const context = isStream
        ? (progress ? `${progress} · 繼續流` : '繼續流')
        : (progress ? `${progress} · 之後繼續本節目` : '播放後繼續本節目');
      const streamFilter = String(item.streamFilter || '').trim();
      const subtitle = isStream && item.streamVersion
        ? [item.showName || '', item.streamVersion, streamFilter].filter(Boolean).join(' · ')
        : item.showName;
      return `
        <button class="recent-podcast" type="button" data-recent-index="${index}" title="${escapeHtml(item.episodeTitle)}">
          <span class="recent-episode">${escapeHtml(item.episodeTitle)}</span>
          <span class="recent-show">${escapeHtml(subtitle)}</span>
          <span class="recent-progress">${escapeHtml(context)}</span>
        </button>
      `;
    }).join('');
  }

  function normalizedProgress(currentTime, duration) {
    const progress = Number(currentTime);
    const total = Number(duration);
    if (!Number.isFinite(progress) || progress < MIN_RESUME_SECONDS) return 0;
    if (Number.isFinite(total) && total > 0) {
      if (total - progress <= END_GUARD_SECONDS || progress / total >= 0.98) return 0;
    }
    return progress;
  }

  function readRawStreamItems() {
    try {
      const value = JSON.parse(localStorage.getItem(STREAM_STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function readStreamItems(rawItems = readRawStreamItems(), filter = localStorage.getItem(STREAM_FILTER_KEY) || '') {
    const query = normalize(filter);
    return rawItems.filter(item =>
      (!query || normalize(item?.title).includes(query)) &&
      typeof item?.audio === 'string' && item.audio.startsWith('https://') &&
      Number.isFinite(item?.durationSeconds) && item.durationSeconds > 0
    );
  }

  function streamVersion(rawItems = readRawStreamItems(), filter = localStorage.getItem(STREAM_FILTER_KEY) || '') {
    const source = JSON.stringify({
      items: rawItems.map(item => [item?.key || '', item?.audio || '', Number(item?.durationSeconds) || 0, item?.title || '']),
      filter
    });
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function streamGlobalProgress(audio, items) {
    if (!audio || !items.length || !Number.isFinite(audio.currentTime) || audio.currentTime < 0) return 0;
    if (audio.dataset.playlistMode === 'ios-hls') return audio.currentTime;
    if (audio.dataset.playlistMode !== 'desktop-sequential') return 0;

    const src = audio.currentSrc || audio.src || '';
    let total = 0;
    for (const item of items) {
      let matches = item.audio === src;
      if (!matches) {
        try { matches = new URL(item.audio, location.href).href === src; } catch {}
      }
      if (matches) return total + audio.currentTime;
      total += Number(item.durationSeconds) || 0;
    }
    return 0;
  }

  function streamSnapshot() {
    if (typeof els === 'undefined' || !els.audio) return null;
    const audio = els.audio;
    const mode = audio.dataset.playlistMode;
    if (mode !== 'ios-hls' && mode !== 'desktop-sequential') return null;
    const rawItems = readRawStreamItems();
    const filter = localStorage.getItem(STREAM_FILTER_KEY) || '';
    const items = readStreamItems(rawItems, filter);
    if (!items.length) return null;
    const version = streamVersion(rawItems, filter);
    const duration = items.reduce((sum, item) => sum + (Number(item.durationSeconds) || 0), 0);
    const progress = normalizedProgress(streamGlobalProgress(audio, items), duration);
    return {
      kind: 'stream',
      showId: `__stream__:${version}`,
      episodeId: `__stream__:${version}`,
      showName: `${items.length} 個單集`,
      publisher: '',
      artwork: '',
      episodeTitle: '流',
      audio: '',
      publishedAt: '',
      duration: '',
      progressSeconds: progress,
      mediaDurationSeconds: duration,
      streamVersion: version,
      streamItems: rawItems,
      streamFilter: filter,
      updatedAt: Date.now()
    };
  }

  function currentSnapshot() {
    const stream = streamSnapshot();
    if (stream) return stream;
    if (typeof state === 'undefined' || !state.current || typeof els === 'undefined') return null;
    const current = state.current;
    const show = state.detailShow?.id === current.showId
      ? state.detailShow
      : state.shows?.find(item => item.id === current.showId);
    const episode = show?.episodes?.find(item => item.id === current.episodeId);
    const existing = loadRecents().find(item => item.showId === current.showId && item.episodeId === current.episodeId);
    const mediaDuration = Number.isFinite(els.audio?.duration) ? els.audio.duration : Number(existing?.mediaDurationSeconds) || 0;
    const progress = normalizedProgress(els.audio?.currentTime, mediaDuration);

    return {
      showId: current.showId,
      episodeId: current.episodeId,
      showName: show?.name || existing?.showName || els.nowShow?.textContent?.trim() || current.showId,
      publisher: show?.publisher || existing?.publisher || '',
      artwork: show?.artwork || existing?.artwork || els.artwork?.src || '',
      episodeTitle: episode?.title || existing?.episodeTitle || els.nowTitle?.textContent?.trim() || current.episodeId,
      audio: episode?.audio || existing?.audio || els.audio?.currentSrc || els.audio?.src || '',
      publishedAt: episode?.publishedAt || existing?.publishedAt || '',
      duration: episode?.duration || existing?.duration || '',
      progressSeconds: progress,
      mediaDurationSeconds: mediaDuration,
      updatedAt: Date.now()
    };
  }

  function rememberCurrent() {
    const item = currentSnapshot();
    if (!item || (item.kind !== 'stream' && !item.audio)) return;
    const recents = loadRecents().filter(entry => !(entry.showId === item.showId && entry.episodeId === item.episodeId));
    recents.unshift(item);
    saveRecents(recents);
    renderRecents();
  }

  function saveCurrentProgress({ render = false } = {}) {
    if (restoringRecent) return;
    const item = currentSnapshot();
    if (!item || (item.kind !== 'stream' && !item.audio)) return;
    const recents = loadRecents();
    const index = recents.findIndex(entry => entry.showId === item.showId && entry.episodeId === item.episodeId);
    if (index === -1) recents.unshift(item);
    else recents[index] = { ...recents[index], ...item };
    saveRecents(recents);
    if (render) renderRecents();
  }

  function restoreProgress(item) {
    if (typeof els === 'undefined' || !els.audio) return Promise.resolve();
    const audio = els.audio;
    const resumeAt = Number(item.progressSeconds) || 0;
    const storedDuration = Number(item.mediaDurationSeconds) || 0;
    if (resumeAt < MIN_RESUME_SECONDS) return Promise.resolve();
    if (storedDuration > 0 && (storedDuration - resumeAt <= END_GUARD_SECONDS || resumeAt / storedDuration >= 0.98)) return Promise.resolve();

    return new Promise(resolve => {
      const seek = () => {
        if (typeof state === 'undefined' || state.current?.showId !== item.showId || state.current?.episodeId !== item.episodeId) {
          resolve();
          return;
        }
        const duration = Number.isFinite(audio.duration) ? audio.duration : storedDuration;
        const target = duration > 0 ? Math.min(resumeAt, Math.max(0, duration - END_GUARD_SECONDS)) : resumeAt;
        try { audio.currentTime = target; } catch {}
        resolve();
      };

      if (audio.readyState >= 1) seek();
      else audio.addEventListener('loadedmetadata', seek, { once: true });
    });
  }

  async function playRecentStream(item) {
    if (Array.isArray(item?.streamItems)) {
      localStorage.setItem(STREAM_STORAGE_KEY, JSON.stringify(item.streamItems));
      localStorage.setItem(STREAM_FILTER_KEY, item.streamFilter || '');
      window.dispatchEvent(new CustomEvent('stream-change'));
      window.dispatchEvent(new CustomEvent('stream-filter-change'));
    }
    const playlistTab = document.querySelector('.view-tab[data-view="playlist"]');
    if (playlistTab && !playlistTab.classList.contains('active')) playlistTab.click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const startButton = document.querySelector('#streamStart');
    if (startButton && !startButton.disabled) startButton.click();
  }

  async function playRecent(item) {
    if (item?.kind === 'stream') {
      await playRecentStream(item);
      return;
    }
    if (!item?.audio || typeof toggleEpisode !== 'function') return;

    let show = null;
    try {
      const response = await fetch(`./shows/${encodeURIComponent(item.showId)}.json`, { cache: 'no-store' });
      if (response.ok) show = await response.json();
    } catch {}

    if (!show) {
      show = {
        id: item.showId,
        name: item.showName,
        publisher: item.publisher || '',
        artwork: item.artwork || '',
        episodes: []
      };
    }

    if (typeof state !== 'undefined') state.detailShow = show;

    const episode = show.episodes?.find(entry => entry.id === item.episodeId) || {
      id: item.episodeId,
      title: item.episodeTitle,
      audio: item.audio,
      publishedAt: item.publishedAt || '',
      duration: item.duration || ''
    };

    restoringRecent = true;
    try {
      await toggleEpisode(show, episode);
      await restoreProgress(item);
    } finally {
      restoringRecent = false;
      lastProgressSaveAt = Date.now();
      saveCurrentProgress({ render: true });
    }
  }

  const audio = document.querySelector('#audio');
  audio?.addEventListener('playing', () => {
    if (!restoringRecent) rememberCurrent();
    lastProgressSaveAt = Date.now();
  });
  audio?.addEventListener('timeupdate', () => {
    if (restoringRecent) return;
    const now = Date.now();
    if (now - lastProgressSaveAt < SAVE_INTERVAL_MS) return;
    lastProgressSaveAt = now;
    saveCurrentProgress();
  });
  audio?.addEventListener('pause', () => saveCurrentProgress({ render: true }));
  audio?.addEventListener('ended', () => saveCurrentProgress({ render: true }));
  window.addEventListener('pagehide', () => saveCurrentProgress());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCurrentProgress();
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-recent-index]');
    if (!button) return;
    const item = loadRecents()[Number(button.dataset.recentIndex)];
    if (!item) return;
    playRecent(item).catch(() => {});
  });

  document.addEventListener('web-podcasts:recents-updated', renderRecents);
  renderRecents();

  const syncStyle = document.createElement('link');
  syncStyle.rel = 'stylesheet';
  syncStyle.href = './sync.css';
  document.head.appendChild(syncStyle);

  const syncScript = document.createElement('script');
  syncScript.src = './sync.js';
  document.body.appendChild(syncScript);
})();
