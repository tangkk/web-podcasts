(() => {
  const STORAGE_KEY = 'web-podcasts:stream:v1';
  const FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const PLAYHEAD_KEY = 'web-podcasts:stream-playhead:v1';
  const PLAYLIST_API = 'https://media.tangkk-x2o.com/api/playlist';
  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  if (!audio || !player) return;

  const normalize = value => String(value || '').toLocaleLowerCase().normalize('NFKC').trim();
  const isIOSFamily = () => {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  };

  const readRawItems = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  const readFilter = () => localStorage.getItem(FILTER_KEY) || '';

  const streamVersion = () => {
    const source = JSON.stringify({
      items: readRawItems().map(item => [item?.key || '', item?.audio || '', Number(item?.durationSeconds) || 0, item?.title || '']),
      filter: readFilter()
    });
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  };

  const readItems = () => {
    const parsed = readRawItems();
    const query = normalize(readFilter());
    return parsed.filter(item =>
      (!query || normalize(item?.title).includes(query)) &&
      typeof item?.audio === 'string' && item.audio.startsWith('https://') &&
      Number.isFinite(item?.durationSeconds) && item.durationSeconds > 0
    );
  };

  const readPlayhead = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PLAYHEAD_KEY) || 'null');
      return value &&
        typeof value.streamVersion === 'string' &&
        typeof value.key === 'string' &&
        Number.isFinite(value.offsetSeconds) ? value : null;
    } catch { return null; }
  };

  const globalTimeForPlayhead = items => {
    const playhead = readPlayhead();
    if (!playhead || playhead.streamVersion !== streamVersion()) return null;
    let total = 0;
    for (const item of items) {
      if (item.key === playhead.key) {
        return total + Math.max(0, Math.min(playhead.offsetSeconds, Math.max(0, item.durationSeconds - 0.25)));
      }
      total += item.durationSeconds;
    }
    return null;
  };

  const globalTimeForKey = (items, key) => {
    let total = 0;
    for (const item of items) {
      if (item.key === key) return total;
      total += item.durationSeconds;
    }
    return null;
  };

  const fingerprintItems = items => JSON.stringify(items.map(item => [item.key || '', item.audio, item.durationSeconds, item.title || '']));
  let prepared = {fingerprint:'', url:'', promise:null};

  async function preparePlaylist(items = readItems()) {
    if (!isIOSFamily() || !items.length) return null;
    const fingerprint = fingerprintItems(items);
    if (prepared.fingerprint === fingerprint && prepared.url) return prepared.url;
    if (prepared.fingerprint === fingerprint && prepared.promise) return prepared.promise;
    const promise = (async () => {
      const response = await fetch(PLAYLIST_API, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({items:items.map(item => ({audio:item.audio,durationSeconds:item.durationSeconds,showName:item.showName || '',title:item.title || ''}))})
      });
      if (!response.ok) throw new Error(`V1 playlist HTTP ${response.status}`);
      const data = await response.json();
      if (!data?.url || typeof data.url !== 'string' || !data.url.startsWith('https://')) throw new Error('V1 playlist response missing HTTPS url');
      prepared = {fingerprint, url:data.url, promise:null};
      return data.url;
    })();
    prepared = {fingerprint, url:'', promise};
    try { return await promise; }
    catch (error) {
      if (prepared.fingerprint === fingerprint) prepared = {fingerprint:'', url:'', promise:null};
      throw error;
    }
  }

  function startNativeHls(url, items, requestedTime = null) {
    const fingerprint = fingerprintItems(items);
    audio.dataset.streamHls = '1';
    audio.dataset.playlistMode = 'ios-hls';
    audio.dataset.streamFingerprint = fingerprint;
    player.hidden = false;
    if (nowShow) nowShow.textContent = '播放列表';
    if (nowTitle) nowTitle.textContent = `${items.length} 个单集 · iOS HLS`;

    const restoreTime = Number.isFinite(requestedTime) ? requestedTime : globalTimeForPlayhead(items);
    if (Number.isFinite(restoreTime) && restoreTime >= 0) {
      audio.addEventListener('loadedmetadata', () => {
        try {
          const maxTime = Number.isFinite(audio.duration) ? Math.max(0, audio.duration - 0.25) : restoreTime;
          audio.currentTime = Math.min(restoreTime, maxTime);
        } catch {}
      }, {once:true});
    }

    audio.src = url;
    audio.load();
    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch(error => {
        const button = document.querySelector('#streamStart');
        if (button && error?.name === 'NotAllowedError') button.title = '播放列表已准备好，点击播放';
        else console.warn('iOS HLS play failed', error);
      });
    }
  }

  const playFromEpisode = async key => {
    const items = readItems();
    if (!items.length) return;
    const targetTime = globalTimeForKey(items, key);
    if (!Number.isFinite(targetTime)) return;
    const fingerprint = fingerprintItems(items);

    if (audio.dataset.playlistMode === 'ios-hls' && audio.dataset.streamFingerprint === fingerprint) {
      try { audio.currentTime = targetTime; } catch {}
      if (audio.paused || audio.ended) await audio.play();
      return;
    }

    const nativeHls = audio.canPlayType('application/vnd.apple.mpegurl') || audio.canPlayType('application/x-mpegURL');
    if (!nativeHls) return;
    const url = prepared.fingerprint === fingerprint && prepared.url
      ? prepared.url
      : await preparePlaylist(items);
    startNativeHls(url, items, targetTime);
  };

  const schedulePrepare = () => {
    if (!isIOSFamily()) return;
    const items = readItems();
    if (!items.length) { prepared = {fingerprint:'', url:'', promise:null}; return; }
    preparePlaylist(items).catch(() => {});
  };

  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === FILTER_KEY) schedulePrepare();
  });
  window.addEventListener('stream-change', schedulePrepare);
  window.addEventListener('stream-filter-change', () => { prepared = {fingerprint:'', url:'', promise:null}; schedulePrepare(); });
  setTimeout(schedulePrepare, 0);

  document.addEventListener('click', event => {
    if (!isIOSFamily()) return;

    const episodeButton = event.target.closest('.stream-episode-play');
    if (episodeButton && !episodeButton.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const row = episodeButton.closest('.stream-row[data-queue-key]');
      const key = row?.dataset.queueKey;
      if (key) playFromEpisode(key).catch(error => console.warn('iOS stream episode seek failed', error));
      return;
    }

    if (event.target.closest('.play-card') || event.target.closest('#closePlayer')) {
      delete audio.dataset.streamHls;
      delete audio.dataset.playlistMode;
      delete audio.dataset.streamFingerprint;
      return;
    }
    const startButton = event.target.closest('#streamStart');
    if (!startButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (audio.dataset.playlistMode === 'ios-hls') {
      if (audio.paused || audio.ended) audio.play().catch(error => console.warn('iOS HLS resume failed', error));
      else audio.pause();
      return;
    }

    const items = readItems();
    if (!items.length) return;
    const fingerprint = fingerprintItems(items);
    const nativeHls = audio.canPlayType('application/vnd.apple.mpegurl') || audio.canPlayType('application/x-mpegURL');
    if (!nativeHls) { alert('当前 iOS 浏览器没有报告原生 HLS 支持。'); return; }

    if (prepared.fingerprint === fingerprint && prepared.url) { startNativeHls(prepared.url, items); return; }

    startButton.disabled = true;
    const original = startButton.textContent;
    startButton.textContent = '…';
    preparePlaylist(items).then(url => {
      startButton.disabled = false;
      startButton.textContent = original;
      startNativeHls(url, items);
    }).catch(error => {
      startButton.disabled = false;
      startButton.textContent = original;
      alert(`播放列表准备失败：${error?.message || error}`);
    });
  }, true);
})();