(() => {
  const STREAM_KEY = 'web-podcasts:stream:v1';
  const FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const PLAYLIST_API = 'https://media.tangkk-x2o.com/api/playlist';
  const directory = document.querySelector('#directory');
  if (!directory) return;

  const normalize = value => String(value || '').toLocaleLowerCase().normalize('NFKC').trim();
  const isIOSFamily = () => {
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

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

  const fingerprintItems = items => JSON.stringify(items.map(item => [item?.key || '', item?.audio || '', Number(item?.durationSeconds) || 0, item?.title || '']));
  let prepared = {fingerprint:'', url:'', promise:null};

  function updateButtonState() {
    const button = document.querySelector('#streamCopyLink');
    if (!button) return;
    const items = effectiveQueue();
    const fingerprint = fingerprintItems(items);
    const ready = !!items.length && prepared.fingerprint === fingerprint && !!prepared.url;
    button.disabled = !ready;
    button.setAttribute('aria-busy', String(!!prepared.promise && prepared.fingerprint === fingerprint));
    if (!ready && button.textContent !== '✓' && button.textContent !== '!') button.textContent = '⧉';
  }

  async function preparePlaylistUrl() {
    const items = effectiveQueue();
    if (!items.length) {
      prepared = {fingerprint:'', url:'', promise:null};
      updateButtonState();
      return null;
    }

    const fingerprint = fingerprintItems(items);
    if (prepared.fingerprint === fingerprint && prepared.url) return prepared.url;
    if (prepared.fingerprint === fingerprint && prepared.promise) return prepared.promise;

    const promise = (async () => {
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
      prepared = {fingerprint, url:data.url, promise:null};
      updateButtonState();
      return data.url;
    })();

    prepared = {fingerprint, url:'', promise};
    updateButtonState();
    try {
      return await promise;
    } catch (error) {
      if (prepared.fingerprint === fingerprint) prepared = {fingerprint:'', url:'', promise:null};
      updateButtonState();
      throw error;
    }
  }

  function legacyCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus({preventScroll:true});
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  }

  function copyPreparedUrl(text) {
    if (isIOSFamily() && legacyCopy(text)) return Promise.resolve();
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    if (legacyCopy(text)) return Promise.resolve();
    return Promise.reject(new Error('copy unavailable'));
  }

  function ensureCopyButton() {
    const filterBar = document.querySelector('.stream-view[data-stream-view="1"] .stream-filter-bar');
    const field = filterBar?.querySelector('.stream-filter-field');
    if (!filterBar || !field) return;

    let button = filterBar.querySelector('#streamCopyLink');
    if (!button) {
      button = document.createElement('button');
      button.id = 'streamCopyLink';
      button.type = 'button';
      button.textContent = '⧉';
      button.setAttribute('aria-label', '复制这个流的 M3U8 链接');
      button.title = '复制这个流的 M3U8 链接';
      field.insertAdjacentElement('afterend', button);
    }
    updateButtonState();
  }

  function refreshPreparedUrl() {
    prepared = {fingerprint:'', url:'', promise:null};
    requestAnimationFrame(() => {
      ensureCopyButton();
      preparePlaylistUrl().catch(error => console.warn('Stream M3U8 prepare failed', error));
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#streamCopyLink');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();

    const items = effectiveQueue();
    const fingerprint = fingerprintItems(items);
    const url = prepared.fingerprint === fingerprint ? prepared.url : '';
    if (!url) return;

    copyPreparedUrl(url).then(() => {
      button.textContent = '✓';
    }).catch(error => {
      console.warn('Stream M3U8 copy failed', error);
      button.textContent = '!';
    }).finally(() => {
      setTimeout(() => {
        if (!button.isConnected) return;
        button.textContent = '⧉';
        updateButtonState();
      }, 1200);
    });
  }, true);

  window.addEventListener('stream-change', refreshPreparedUrl);
  window.addEventListener('stream-filter-change', refreshPreparedUrl);
  window.addEventListener('storage', event => {
    if (event.key === STREAM_KEY || event.key === FILTER_KEY) refreshPreparedUrl();
  });

  const observer = new MutationObserver(mutations => {
    if (!mutations.some(mutation => [...mutation.addedNodes].some(node =>
      node.nodeType === 1 && (
        node.matches?.('.stream-view, .stream-filter-bar') ||
        node.querySelector?.('.stream-view, .stream-filter-bar')
      )
    ))) return;
    requestAnimationFrame(() => {
      ensureCopyButton();
      preparePlaylistUrl().catch(error => console.warn('Stream M3U8 prepare failed', error));
    });
  });
  observer.observe(directory, {subtree:true, childList:true});

  const style = document.createElement('style');
  style.textContent = `
    .stream-filter-bar #streamCopyLink{width:32px;height:32px;min-width:32px;box-sizing:border-box;border:1px solid var(--line);border-radius:50%;background:#fff;color:var(--ink);padding:0;font:inherit;font-size:17px;line-height:1;display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent;align-self:flex-end}
    .stream-filter-bar #streamCopyLink:disabled{opacity:.35;cursor:default}
    .stream-filter-bar .stream-filter-field{flex:1 1 auto;min-width:0}
  `;
  document.head.appendChild(style);

  requestAnimationFrame(() => {
    ensureCopyButton();
    preparePlaylistUrl().catch(error => console.warn('Stream M3U8 prepare failed', error));
  });
})();
