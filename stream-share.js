(() => {
  const STREAM_KEY = 'web-podcasts:stream:v1';
  const FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const MAX_ITEMS = 100;
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

  const currentFilter = () => localStorage.getItem(FILTER_KEY) || '';
  const effectiveQueue = () => {
    const query = normalize(currentFilter());
    return readQueue().filter(item => !query || normalize(item?.title).includes(query));
  };

  function encodePayload(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
  }

  function downloadUrl() {
    const items = effectiveQueue().slice(0, MAX_ITEMS);
    if (!items.length) return null;
    const payload = {
      v: 1,
      kind: 'web-podcasts-stream-download',
      items: items.map(item => ({
        showId: item?.showId || '',
        episodeId: item?.episodeId || '',
        showName: item?.showName || '',
        title: item?.title || '',
        audio: item?.audio || '',
        durationSeconds: Number(item?.durationSeconds) || 0
      }))
    };
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set('stream_download', encodePayload(payload));
    return url.href;
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
    button.setAttribute('aria-label', '复制这个流的下载链接');
    button.title = '复制这个流的下载链接';
    start.insertAdjacentElement('afterend', button);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#streamCopyLink');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const url = downloadUrl();
    if (!url) return;
    const original = button.textContent;
    writeClipboard(url).then(() => {
      button.textContent = '已复制';
      setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1200);
    }).catch(error => {
      console.warn('Stream download link copy failed', error);
      button.textContent = '复制失败';
      setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1200);
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
