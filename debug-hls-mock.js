(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const STORAGE_KEY = 'web-podcasts:debug-playlist:v2';
  const PLAYLIST_API = 'https://media.tangkk-x2o.com/api/playlist';
  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  const debugPanel = document.querySelector('#debugPanel');
  const debugToggle = document.querySelector('#debugToggle');
  const debugLog = document.querySelector('#debugLog');
  const debugHead = debugPanel?.querySelector('.debug-head');
  if (!audio || !player) return;

  const log = (message, detail) => {
    if (!debugLog) return;
    const line = `[IOS HLS ${new Date().toLocaleTimeString('zh-Hant', {hour12:false})}] ${message}${detail ? ' · ' + JSON.stringify(detail) : ''}`;
    debugLog.textContent += line + '\n';
    debugLog.scrollTop = debugLog.scrollHeight;
  };

  if (debugHead && !document.querySelector('#copyDebug')) {
    const copyButton = document.createElement('button');
    copyButton.id = 'copyDebug';
    copyButton.type = 'button';
    copyButton.textContent = '复制';
    copyButton.addEventListener('click', async () => {
      const text = debugLog?.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        const original = copyButton.textContent;
        copyButton.textContent = '已复制';
        setTimeout(() => { copyButton.textContent = original; }, 1200);
      } catch (error) {
        log('debug copy failed', {message:error?.message || String(error)});
      }
    });
    const clearButton = document.querySelector('#clearDebug');
    debugHead.insertBefore(copyButton, clearButton || null);
  }

  const isIOSFamily = () => {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  };

  const readItems = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item =>
        typeof item?.audio === 'string' &&
        item.audio.startsWith('https://') &&
        Number.isFinite(item?.durationSeconds) &&
        item.durationSeconds > 0
      );
    } catch {
      return [];
    }
  };

  const fingerprintItems = items => JSON.stringify(items.map(item => [
    item.key || '', item.audio, item.durationSeconds, item.title || ''
  ]));

  let prepared = {fingerprint:'', url:'', promise:null};

  async function preparePlaylist(items = readItems()) {
    if (!isIOSFamily() || !items.length) return null;
    const fingerprint = fingerprintItems(items);
    if (prepared.fingerprint === fingerprint && prepared.url) return prepared.url;
    if (prepared.fingerprint === fingerprint && prepared.promise) return prepared.promise;

    const promise = (async () => {
      log('preparing V1 playlist', {count:items.length});
      const response = await fetch(PLAYLIST_API, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          items: items.map(item => ({
            audio: item.audio,
            durationSeconds: item.durationSeconds,
            showName: item.showName || '',
            title: item.title || ''
          }))
        })
      });
      if (!response.ok) throw new Error(`V1 playlist HTTP ${response.status}`);
      const data = await response.json();
      if (!data?.url || typeof data.url !== 'string' || !data.url.startsWith('https://')) {
        throw new Error('V1 playlist response missing HTTPS url');
      }
      prepared = {fingerprint, url:data.url, promise:null};
      log('V1 playlist ready', {count:items.length, id:data.id || null, url:data.url});
      return data.url;
    })();

    prepared = {fingerprint, url:'', promise};
    try {
      return await promise;
    } catch (error) {
      if (prepared.fingerprint === fingerprint) prepared = {fingerprint:'', url:'', promise:null};
      log('V1 playlist prepare failed', {message:error?.message || String(error)});
      throw error;
    }
  }

  function startNativeHls(url, items) {
    audio.dataset.hlsMock = '1';
    audio.dataset.playlistMode = 'ios-hls';
    player.hidden = false;
    if (nowShow) nowShow.textContent = '播放列表';
    if (nowTitle) nowTitle.textContent = `${items.length} 个单集 · iOS HLS`;
    if (debugPanel) debugPanel.hidden = false;
    if (debugToggle) debugToggle.setAttribute('aria-expanded','true');

    audio.src = url;
    audio.load();
    log('native HLS source selected', {
      count:items.length,
      url,
      canPlayHls:audio.canPlayType('application/vnd.apple.mpegurl') || audio.canPlayType('application/x-mpegURL') || ''
    });

    const playPromise = audio.play();
    if (playPromise?.then) {
      playPromise.then(() => log('native HLS play started', {url})).catch(error => {
        log('native HLS play rejected', {name:error?.name, message:error?.message});
        const button = document.querySelector('#debugPlaylistStart');
        if (button && error?.name === 'NotAllowedError') button.title = '播放列表已准备好，点击播放';
      });
    }
  }

  const schedulePrepare = () => {
    if (!isIOSFamily()) return;
    const items = readItems();
    if (!items.length) {
      prepared = {fingerprint:'', url:'', promise:null};
      return;
    }
    preparePlaylist(items).catch(() => {});
  };

  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) schedulePrepare();
  });
  window.addEventListener('debug-playlist-change', schedulePrepare);
  setTimeout(schedulePrepare, 0);

  document.addEventListener('click', event => {
    if (event.target.closest('.play-card') || event.target.closest('#closePlayer')) {
      delete audio.dataset.hlsMock;
      delete audio.dataset.playlistMode;
      return;
    }

    const startButton = event.target.closest('#debugPlaylistStart');
    if (!startButton || !isIOSFamily()) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (audio.dataset.playlistMode === 'ios-hls') {
      if (audio.paused || audio.ended) {
        audio.play().catch(error => log('native HLS resume failed', {name:error?.name, message:error?.message}));
      } else {
        audio.pause();
      }
      return;
    }

    const items = readItems();
    if (!items.length) return;
    const fingerprint = fingerprintItems(items);
    const nativeHls = audio.canPlayType('application/vnd.apple.mpegurl') || audio.canPlayType('application/x-mpegURL');
    if (!nativeHls) {
      log('native HLS unavailable');
      alert('当前 iOS 浏览器没有报告原生 HLS 支持。');
      return;
    }

    if (prepared.fingerprint === fingerprint && prepared.url) {
      startNativeHls(prepared.url, items);
      return;
    }

    startButton.disabled = true;
    const original = startButton.textContent;
    startButton.textContent = '…';
    preparePlaylist(items).then(url => {
      startButton.disabled = false;
      startButton.textContent = original;
      log('playlist prepared after click; starting native HLS', {url});
      startNativeHls(url, items);
    }).catch(error => {
      startButton.disabled = false;
      startButton.textContent = original;
      alert(`播放列表准备失败：${error?.message || error}`);
    });
  }, true);
})();