(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const HLS_JS_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.0/dist/hls.min.js';
  const directory = document.querySelector('#directory');
  const player = document.querySelector('#player');
  const audio = document.querySelector('#audio');
  const artwork = document.querySelector('#playerArtwork');
  const nowShow = document.querySelector('#nowShow');
  const nowTitle = document.querySelector('#nowTitle');
  const debugPanel = document.querySelector('#debugPanel');
  const debugToggle = document.querySelector('#debugToggle');
  const debugLog = document.querySelector('#debugLog');
  const debugHead = debugPanel?.querySelector('.debug-head');
  if (!directory || !player || !audio) return;

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
        const line = `[${new Date().toLocaleTimeString('zh-Hant', {hour12:false})}] Debug copy failed · ${error?.message || error}\n`;
        if (debugLog) debugLog.textContent += line;
      }
    });
    const clearButton = document.querySelector('#clearDebug');
    debugHead.insertBefore(copyButton, clearButton || null);
  }

  let mockActive = false;
  let activeHls = null;
  const playlistUrl = new URL('./debug-hls/mock.m3u8', location.href).href;
  const segmentUrls = [
    new URL('./debug-hls/mp3-seg1.mp3', location.href).href,
    'https://media.tangkk-x2o.com/seg2.mp3',
    new URL('./debug-hls/mp3-seg3.mp3', location.href).href
  ];

  const log = (message, detail) => {
    if (!debugLog) return;
    const line = `[HLS MOCK ${new Date().toLocaleTimeString('zh-Hant', {hour12:false})}] ${message}${detail ? ' · ' + JSON.stringify(detail) : ''}`;
    debugLog.textContent += line + '\n';
    debugLog.scrollTop = debugLog.scrollHeight;
  };

  const clearMockMode = () => {
    mockActive = false;
    activeHls?.destroy();
    activeHls = null;
    delete audio.dataset.hlsMock;
  };

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

  const section = document.createElement('section');
  section.style.cssText = 'border:1px dashed #e4332a;border-radius:11px;padding:14px;margin:0 0 12px;background:#fff7f6;';
  section.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap"><div><div style="color:#e4332a;font-size:10px;font-weight:800;letter-spacing:.08em">DEBUG · DESKTOP CHROME HLS TEST · V8</div><strong style="display:block;margin-top:4px">3 × 30s · GitHub → R2 → GitHub</strong><span style="display:block;margin-top:4px;color:#686868;font-size:11px">Desktop Chrome/Firefox 强制使用 hls.js；Safari/iOS 使用原生 HLS。用于验证 30s / 60s 两次 segment 切换。</span></div><button id="playHlsMock" type="button" style="border:1px solid #111;border-radius:999px;padding:8px 12px;background:#fff;cursor:pointer">播放 90 秒测试</button></div>';
  directory.parentNode.insertBefore(section, directory);

  section.querySelector('#playHlsMock').addEventListener('click', async () => {
    clearMockMode();
    mockActive = true;
    audio.dataset.hlsMock = '1';
    player.hidden = false;
    if (artwork) artwork.removeAttribute('src');
    if (nowShow) nowShow.textContent = 'DESKTOP HLS TEST';
    if (nowTitle) nowTitle.textContent = 'GitHub → R2 → GitHub / 3 × 30s MP3';
    if (debugPanel) debugPanel.hidden = false;
    if (debugToggle) debugToggle.setAttribute('aria-expanded','true');

    const ua = navigator.userAgent || '';
    const nativeHls = audio.canPlayType('application/vnd.apple.mpegurl');
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isDesktopSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox|CriOS|FxiOS|EdgiOS/i.test(ua);
    const useNativeHls = (isIOS || isDesktopSafari) && !!nativeHls;
    const useHlsJs = !useNativeHls;
    log('90s playlist selected', {
      playlist: playlistUrl,
      segments: segmentUrls,
      canPlayHls: nativeHls || '',
      userAgent: ua,
      useNativeHls,
      useHlsJs
    });

    try {
      if (useNativeHls) {
        audio.src = `${playlistUrl}?v=8`;
        audio.load();
        await audio.play();
        log('native HLS play started', {src:audio.currentSrc});
        return;
      }

      const Hls = await ensureHlsJs();
      if (!Hls.isSupported()) throw new Error('hls.js reports MSE unsupported');
      activeHls = new Hls({enableWorker:true});
      activeHls.attachMedia(audio);
      activeHls.on(Hls.Events.MEDIA_ATTACHED, () => {
        log('hls.js media attached');
        activeHls.loadSource(`${playlistUrl}?v=8`);
      });
      activeHls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        log('hls.js manifest parsed', {levels:data?.levels?.length ?? null});
        audio.play().then(() => log('hls.js play started', {src:audio.currentSrc})).catch(error => log('hls.js play rejected', {name:error.name, message:error.message}));
      });
      activeHls.on(Hls.Events.FRAG_CHANGED, (_event, data) => {
        log('hls.js fragment changed', {sn:data?.frag?.sn ?? null, url:data?.frag?.url ?? null});
      });
      activeHls.on(Hls.Events.ERROR, (_event, data) => {
        log('hls.js error', {type:data.type, details:data.details, fatal:data.fatal, response:data.response?.code || null, url:data.frag?.url || data.context?.url || null});
      });
    } catch (error) {
      log('desktop HLS setup failed', {name:error.name, message:error.message});
    }
  });

  document.addEventListener('click', event => {
    if (event.target.closest('.play-card') || event.target.closest('#closePlayer')) clearMockMode();
  }, true);

  ['loadstart','loadedmetadata','canplay','playing','waiting','stalled','ended','error'].forEach(type => {
    audio.addEventListener(type, () => {
      if (!mockActive) return;
      log('audio ' + type, {
        t: Number.isFinite(audio.currentTime) ? Number(audio.currentTime.toFixed(3)) : null,
        duration: Number.isFinite(audio.duration) ? Number(audio.duration.toFixed(3)) : null,
        readyState: audio.readyState,
        networkState: audio.networkState,
        currentSrc: audio.currentSrc,
        error: audio.error ? {code:audio.error.code, message:audio.error.message} : null
      });
      if (type === 'ended') clearMockMode();
    });
  });
})();