(() => {
  const STREAM_KEY = 'web-podcasts:stream:v1';
  const FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const MAX_ITEMS = 100;
  const directory = document.querySelector('#directory');
  const viewTabs = document.querySelector('.view-tabs');
  if (!directory || !viewTabs) return;

  const parseDuration = value => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parts = String(value || '').split(':').map(Number);
    if (!parts.length || parts.some(Number.isNaN)) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
  };

  const readQueue = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STREAM_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  function encodePayload(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
  }

  function decodePayload(token) {
    const base64 = token.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - token.length % 4) % 4);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function shareUrl() {
    const queue = readQueue();
    if (!queue.length) return null;
    const payload = {
      v: 1,
      items: queue.slice(0, MAX_ITEMS).map(item => [item?.showId || '', item?.episodeId || '']),
      filter: localStorage.getItem(FILTER_KEY) || ''
    };
    const url = new URL(location.href);
    url.hash = `stream=${encodePayload(payload)}`;
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
    button.setAttribute('aria-label', '复制这个流的链接');
    button.title = '复制这个流的链接';
    start.insertAdjacentElement('afterend', button);
  }

  async function loadSharedItems(pairs) {
    const showIds = [...new Set(pairs.map(pair => pair[0]))];
    const shows = new Map();
    await Promise.all(showIds.map(async showId => {
      const response = await fetch(`./shows/${encodeURIComponent(showId)}.json`, {cache:'no-store'});
      if (!response.ok) throw new Error(`show HTTP ${response.status}`);
      shows.set(showId, await response.json());
    }));

    return pairs.map(([showId, episodeId]) => {
      const show = shows.get(showId);
      const episode = show?.episodes?.find(item => item.id === episodeId);
      if (!show || !episode) throw new Error(`episode not found: ${showId}:${episodeId}`);
      return {
        key: `${show.id}:${episode.id}`,
        showId: show.id,
        episodeId: episode.id,
        showName: show.name || '',
        title: episode.title || '',
        audio: episode.audio,
        artwork: show.artwork || '',
        publisher: show.publisher || '',
        duration: episode.duration,
        durationSeconds: parseDuration(episode.duration)
      };
    });
  }

  async function importFromHash() {
    const match = location.hash.match(/^#stream=([A-Za-z0-9_-]+)$/);
    if (!match) return;
    let payload;
    try {
      payload = decodePayload(match[1]);
    } catch (error) {
      console.warn('Shared stream decode failed', error);
      return;
    }
    if (payload?.v !== 1 || !Array.isArray(payload.items) || !payload.items.length || payload.items.length > MAX_ITEMS) return;
    const pairs = payload.items.map(pair => Array.isArray(pair) ? [String(pair[0] || ''), String(pair[1] || '')] : ['', '']);
    if (pairs.some(([showId, episodeId]) => !showId || !episodeId)) return;

    try {
      const items = await loadSharedItems(pairs);
      localStorage.setItem(STREAM_KEY, JSON.stringify(items));
      localStorage.setItem(FILTER_KEY, typeof payload.filter === 'string' ? payload.filter : '');
      window.dispatchEvent(new CustomEvent('stream-change'));
      window.dispatchEvent(new CustomEvent('stream-filter-change', {detail:{value:localStorage.getItem(FILTER_KEY) || ''}}));
      requestAnimationFrame(() => viewTabs.querySelector('.view-tab[data-view="playlist"]')?.click());
    } catch (error) {
      console.warn('Shared stream import failed', error);
      alert('这个流暂时无法载入。');
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#streamCopyLink');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const url = shareUrl();
    if (!url) return;
    const original = button.textContent;
    writeClipboard(url).then(() => {
      button.textContent = '已复制';
      setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1200);
    }).catch(error => {
      console.warn('Stream link copy failed', error);
      button.textContent = '复制失败';
      setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1200);
    });
  }, true);

  window.addEventListener('stream-change', () => requestAnimationFrame(ensureCopyButton));
  const observer = new MutationObserver(mutations => {
    if (!mutations.some(mutation => [...mutation.addedNodes].some(node =>
      node.nodeType === 1 && (node.matches?.('.stream-view') || node.querySelector?.('.stream-view'))
    ))) return;
    requestAnimationFrame(ensureCopyButton);
  });
  observer.observe(directory, {subtree:true, childList:true});

  ensureCopyButton();
  importFromHash();
})();
