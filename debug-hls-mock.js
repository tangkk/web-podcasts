(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

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
    delete audio.dataset.hlsMock;
  };

  const section = document.createElement('section');
  section.style.cssText = 'border:1px dashed #e4332a;border-radius:11px;padding:14px;margin:0 0 12px;background:#fff7f6;';
  section.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap"><div><div style="color:#e4332a;font-size:10px;font-weight:800;letter-spacing:.08em">DEBUG · CROSS-ORIGIN HLS TEST · V5</div><strong style="display:block;margin-top:4px">GitHub → Cloudflare R2 → GitHub</strong><span style="display:block;margin-top:4px;color:#686868;font-size:11px">3 × 30s MP3；第 2 段来自 media.tangkk-x2o.com。30s / 60s 由 HLS 内部跨域切段，测试期间停用 reconnect / resume repair。</span></div><button id="playHlsMock" type="button" style="border:1px solid #111;border-radius:999px;padding:8px 12px;background:#fff;cursor:pointer">播放 90 秒跨域测试</button></div>';
  directory.parentNode.insertBefore(section, directory);

  section.querySelector('#playHlsMock').addEventListener('click', async () => {
    mockActive = true;
    audio.dataset.hlsMock = '1';
    player.hidden = false;
    if (artwork) artwork.removeAttribute('src');
    if (nowShow) nowShow.textContent = 'HLS CROSS-ORIGIN V5';
    if (nowTitle) nowTitle.textContent = 'GitHub → R2 → GitHub / 3 × 30s MP3';
    audio.src = `${playlistUrl}?v=5`;
    audio.load();
    if (debugPanel) debugPanel.hidden = false;
    if (debugToggle) debugToggle.setAttribute('aria-expanded','true');
    log('CROSS-ORIGIN V5 playlist selected', {playlist:audio.src, segments:segmentUrls, canPlayHls:audio.canPlayType('application/vnd.apple.mpegurl')});
    try {
      await audio.play();
      log('play started', {src:audio.currentSrc});
    } catch (error) {
      log('play rejected', {name:error.name, message:error.message});
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