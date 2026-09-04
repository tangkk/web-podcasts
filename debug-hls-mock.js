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
  if (!directory || !player || !audio) return;

  let mockActive = false;
  const playlistUrl = new URL('./debug-hls/mock.m3u8', location.href).href;
  const segmentUrls = [1, 2, 3].map(index => new URL(`./debug-hls/mp3-seg${index}.mp3`, location.href).href);

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
  section.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap"><div><div style="color:#e4332a;font-size:10px;font-weight:800;letter-spacing:.08em">DEBUG · HLS MOCK</div><strong style="display:block;margin-top:4px">3 × 10s MP3 → one HTTPS m3u8</strong><span style="display:block;margin-top:4px;color:#686868;font-size:11px">440 Hz → 660 Hz → 880 Hz；10s / 20s 由 HLS 内部跨段，DEBUG 测试期间停用 reconnect / resume repair。</span></div><button id="playHlsMock" type="button" style="border:1px solid #111;border-radius:999px;padding:8px 12px;background:#fff;cursor:pointer">播放 30 秒 MP3 测试</button></div>';
  directory.parentNode.insertBefore(section, directory);

  section.querySelector('#playHlsMock').addEventListener('click', async () => {
    mockActive = true;
    audio.dataset.hlsMock = '1';
    player.hidden = false;
    if (artwork) artwork.removeAttribute('src');
    if (nowShow) nowShow.textContent = 'HLS MP3 MOCK';
    if (nowTitle) nowTitle.textContent = '440 → 660 → 880 Hz / single HTTPS m3u8 source';
    audio.src = `${playlistUrl}?v=3`;
    audio.load();
    if (debugPanel) debugPanel.hidden = false;
    if (debugToggle) debugToggle.setAttribute('aria-expanded','true');
    log('MP3 playlist selected', {playlist:audio.src, segments:segmentUrls, canPlayHls:audio.canPlayType('application/vnd.apple.mpegurl')});
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