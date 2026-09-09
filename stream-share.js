(() => {
  const STREAM_KEY = 'web-podcasts:stream:v1';
  const FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const PLAYLIST_API = 'https://media.tangkk-x2o.com/api/playlist';
  const directory = document.querySelector('#directory');
  if (!directory) return;

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

  async function preparePlaylistUrl() {
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

  function ensureCopyButton() {
    const actions = document.querySelector('.stream-view[data-stream-view="1"] .stream-toolbar-actions');
    const start = actions?.querySelector('#streamStart');
    if (!actions || !start || actions.querySelector('#streamCopyLink')) return;
    const button = document.createElement('button');
    button.id = 'streamCopyLink';
    button.type = 'button';
    button.textContent = '复制链接';
    button.setAttribute('aria-label', '复制这个流的 M3U8 链接');
    button.title = '复制这个流的 M3U8 链接';
    start.insertAdjacentElement('afterend', button);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#streamCopyLink');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();

    const original = button.textContent;
    button.disabled = true;
    button.textContent = '生成中…';

    preparePlaylistUrl().then(url => {
      if (!url) throw new Error('stream is empty');
      return writeClipboard(url);
    }).then(() => {
      button.textContent = '已复制';
    }).catch(error => {
      console.warn('Stream M3U8 copy failed', error);
      button.textContent = '复制失败';
    }).finally(() => {
      setTimeout(() => {
        if (!button.isConnected) return;
        button.disabled = false;
        button.textContent = original;
      }, 1200);
    });
  }, true);

  window.addEventListener('stream-change', () => requestAnimationFrame(ensureCopyButton));
  window.addEventListener('stream-filter-change', () => requestAnimationFrame(ensureCopyButton));
  const observer = new MutationObserver(mutations => {
    if (!mutations.some(mutation => [...mutation.addedNodes].some(node =>
      node.nodeType === 1 && (node.matches?.('.stream-view') || node.querySelector?.('.stream-view'))
    ))) return;
    requestAnimationFrame(ensureCopyButton);
  });
  observer.observe(directory, {subtree:true, childList:true});

  ensureCopyButton();
})();
