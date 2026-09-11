(() => {
  const STREAM_KEY = 'web-podcasts:stream:v1';
  const FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const PLAYLIST_API = 'https://media.tangkk-x2o.com/api/playlist';
  const audio = document.querySelector('#audio');
  const speed = document.querySelector('#speedToggle');
  const nowTitle = document.querySelector('#nowTitle');
  if (!audio || !speed || !nowTitle) return;

  const normalize = value => String(value || '').toLocaleLowerCase().normalize('NFKC').trim();

  const readQueue = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STREAM_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const effectiveQueue = () => {
    const query = normalize(localStorage.getItem(FILTER_KEY) || '');
    return readQueue().filter(item =>
      (!query || normalize(item?.title).includes(query)) &&
      typeof item?.audio === 'string' && item.audio.startsWith('https://') &&
      Number.isFinite(item?.durationSeconds) && item.durationSeconds > 0
    );
  };

  const isStreamPlayback = () => {
    const mode = audio.dataset.playlistMode || '';
    return mode === 'ios-hls' || mode === 'desktop-sequential' || mode === 'stream-single';
  };

  async function currentCopyUrl() {
    if (!isStreamPlayback()) {
      const url = audio.currentSrc || audio.src || '';
      return url.startsWith('http://') || url.startsWith('https://') ? url : null;
    }

    if (audio.dataset.playlistMode === 'ios-hls') {
      const url = audio.currentSrc || audio.src || '';
      if (url.startsWith('https://')) return url;
    }

    const items = effectiveQueue();
    if (!items.length) return null;
    const response = await fetch(PLAYLIST_API, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
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
    return data.url;
  }

  async function writeClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    if (!ok) throw new Error('copy unavailable');
  }

  const button = document.createElement('button');
  button.id = 'playerCopyLink';
  button.className = 'speed-toggle player-copy-link';
  button.type = 'button';
  button.textContent = '⧉';
  button.setAttribute('aria-label', '复制当前音频链接');
  button.title = '复制当前音频链接';
  speed.insertAdjacentElement('afterend', button);

  const titleRow = document.createElement('div');
  titleRow.className = 'now-title-row';
  const titleParent = nowTitle.parentNode;
  titleParent.insertBefore(titleRow, nowTitle);
  titleRow.appendChild(nowTitle);

  const mobile = window.matchMedia('(max-width: 560px)');
  function placeCopyButton() {
    if (mobile.matches) {
      if (button.parentNode !== titleRow) titleRow.appendChild(button);
    } else if (button.previousElementSibling !== speed || button.parentNode !== speed.parentNode) {
      speed.insertAdjacentElement('afterend', button);
    }
  }
  mobile.addEventListener?.('change', placeCopyButton);
  placeCopyButton();

  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;

    const original = button.textContent;
    button.disabled = true;
    button.textContent = '…';

    currentCopyUrl().then(url => {
      if (!url) throw new Error('No current audio URL');
      return writeClipboard(url);
    }).then(() => {
      button.textContent = '✓';
    }).catch(error => {
      console.warn('Player link copy failed', error);
      button.textContent = '!';
    }).finally(() => {
      setTimeout(() => {
        if (!button.isConnected) return;
        button.disabled = false;
        button.textContent = original;
      }, 1200);
    });
  });

  const style = document.createElement('style');
  style.textContent = `
    .now-title-row{display:contents}
    .player-copy-link{min-width:32px;text-align:center}
    .player-copy-link:disabled{opacity:.6;cursor:default}
    @media(max-width:560px){
      .now-title-row{
        display:flex;
        grid-column:1 / -1;
        grid-row:5;
        align-items:center;
        justify-content:center;
        gap:6px;
        width:100%;
        min-width:0;
        padding:0 34px;
      }
      .now-title-row .now-title{
        grid-column:auto;
        grid-row:auto;
        width:auto;
        max-width:calc(100% - 36px);
        min-width:0;
        flex:0 1 auto;
        margin-top:-4px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .now-title-row #playerCopyLink{
        position:static;
        flex:0 0 auto;
        min-width:26px;
        width:26px;
        height:26px;
        padding:0;
        border-radius:50%;
        display:grid;
        place-items:center;
        transform:none;
        font-size:12px;
      }
    }
  `;
  document.head.appendChild(style);
})();
