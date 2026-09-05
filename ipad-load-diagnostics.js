(() => {
  const ua = navigator.userAgent || '';
  const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIPad) return;

  const startedAt = performance.now();
  const lines = [];
  const pendingFetches = new Map();
  const resourceStates = new Map();
  let panel = null;
  let output = null;
  let sequence = 0;

  const elapsed = () => `${(performance.now() - startedAt).toFixed(0).padStart(6, ' ')}ms`;
  const shortUrl = value => {
    try {
      const url = new URL(String(value || ''), location.href);
      return `${url.host}${url.pathname}${url.search}`;
    } catch {
      return String(value || '');
    }
  };

  function render() {
    if (!output) return;
    output.textContent = lines.slice(-180).join('\n');
    output.scrollTop = output.scrollHeight;
  }

  function log(message) {
    lines.push(`${elapsed()}  ${message}`);
    if (lines.length > 700) lines.splice(0, lines.length - 700);
    render();
  }

  function installPanel() {
    if (panel) return;
    const intro = document.querySelector('.intro');
    const titleRow = intro?.querySelector('.title-row');
    if (!intro || !titleRow) return;

    panel = document.createElement('section');
    panel.id = 'ipadLoadDiagnostics';
    panel.setAttribute('aria-label', 'iPad load diagnostics');
    panel.innerHTML = `
      <div class="ipad-load-diagnostics-head">
        <strong>iPad Load Diagnostics</strong>
        <button type="button" id="ipadLoadDiagnosticsCopy">复制日志</button>
      </div>
      <pre id="ipadLoadDiagnosticsOutput"></pre>
    `;
    titleRow.insertAdjacentElement('afterend', panel);
    output = panel.querySelector('#ipadLoadDiagnosticsOutput');

    const style = document.createElement('style');
    style.textContent = `
      #ipadLoadDiagnostics{margin:14px 0 16px;padding:12px;border:2px solid #111;border-radius:10px;background:#fff;color:#111}
      .ipad-load-diagnostics-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;font:600 14px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
      #ipadLoadDiagnosticsCopy{border:1px solid #111;border-radius:999px;background:#fff;color:#111;padding:7px 12px;font:600 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace}
      #ipadLoadDiagnosticsOutput{margin:0;min-height:320px;max-height:520px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;-webkit-overflow-scrolling:touch}
    `;
    document.head.appendChild(style);

    const copyButton = panel.querySelector('#ipadLoadDiagnosticsCopy');
    copyButton?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        if (copyButton) copyButton.textContent = '已复制';
        setTimeout(() => { if (copyButton) copyButton.textContent = '复制日志'; }, 1200);
      } catch {
        output?.focus?.();
        window.getSelection()?.selectAllChildren(output);
      }
    });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installPanel, {once:true});
  else installPanel();

  log(`boot readyState=${document.readyState}`);
  log(`UA ${ua}`);
  log(`platform=${navigator.platform} touch=${navigator.maxTouchPoints} online=${navigator.onLine}`);
  document.addEventListener('DOMContentLoaded', () => log(`DOMContentLoaded readyState=${document.readyState}`), {once:true});
  window.addEventListener('load', () => {
    log(`WINDOW LOAD fired readyState=${document.readyState}`);
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) log(`NAV responseEnd=${nav.responseEnd.toFixed(0)} domContentLoaded=${nav.domContentLoadedEventEnd.toFixed(0)} loadEnd=${nav.loadEventEnd.toFixed(0)}`);
  }, {once:true});

  const resourceUrl = target => target?.currentSrc || target?.src || target?.href || '';
  const trackedTag = target => ['SCRIPT','LINK','IMG','AUDIO','VIDEO','IFRAME'].includes(target?.tagName);

  function markResource(target) {
    if (!trackedTag(target) || resourceStates.has(target)) return;
    const url = resourceUrl(target);
    if (!url && !['AUDIO','VIDEO'].includes(target.tagName)) return;
    resourceStates.set(target, {tag:target.tagName, started:performance.now(), url, done:false, outcome:''});
  }

  function scanResources(root = document) {
    const selector = 'script[src],link[href],img,audio,video,iframe[src]';
    const nodes = root?.matches?.(selector) ? [root] : [...(root?.querySelectorAll?.(selector) || [])];
    nodes.forEach(markResource);
  }

  scanResources(document);
  const domObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) scanResources(node);
    }));
  });
  domObserver.observe(document.documentElement, {subtree:true, childList:true});

  document.addEventListener('load', event => {
    const target = event.target;
    if (!trackedTag(target)) return;
    markResource(target);
    const state = resourceStates.get(target);
    if (!state) return;
    state.done = true;
    state.outcome = 'load';
    state.url = resourceUrl(target) || state.url;
    const duration = performance.now() - state.started;
    if (duration >= 1500) log(`${state.tag} SLOW ${duration.toFixed(0)}ms ${shortUrl(state.url)}`);
  }, true);

  window.addEventListener('error', event => {
    const target = event.target;
    if (target && target !== window && target.tagName) {
      markResource(target);
      const state = resourceStates.get(target);
      if (state) {
        state.done = true;
        state.outcome = 'error';
        state.url = resourceUrl(target) || state.url;
      }
      log(`RESOURCE ERROR ${target.tagName} ${shortUrl(resourceUrl(target))}`);
    } else {
      log(`JS ERROR ${event.message || 'unknown'} ${event.filename || ''}:${event.lineno || ''}`);
    }
  }, true);

  window.addEventListener('unhandledrejection', event => log(`PROMISE ERROR ${String(event.reason?.message || event.reason || 'unknown')}`));

  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource' && entry.duration >= 1500) {
            log(`RESOURCE SLOW ${entry.duration.toFixed(0)}ms ${entry.initiatorType} ${shortUrl(entry.name)}`);
          }
        }
      });
      observer.observe({type:'resource', buffered:true});
    } catch {}
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function ipadDiagnosticFetch(input, init) {
    const id = ++sequence;
    const rawUrl = typeof input === 'string' || input instanceof URL ? input : input?.url;
    const started = performance.now();
    pendingFetches.set(id, {url:rawUrl, started});
    try {
      const response = await nativeFetch(input, init);
      const duration = performance.now() - started;
      if (duration >= 1500) log(`FETCH SLOW ${duration.toFixed(0)}ms HTTP ${response.status} ${shortUrl(rawUrl)}`);
      return response;
    } catch (error) {
      log(`FETCH ERROR ${(performance.now() - started).toFixed(0)}ms ${shortUrl(rawUrl)} ${error?.message || error}`);
      throw error;
    } finally {
      pendingFetches.delete(id);
    }
  };

  async function reportServiceWorker() {
    if (!('serviceWorker' in navigator)) return log('SW unsupported');
    log(`SW controller=${navigator.serviceWorker.controller?.scriptURL ? shortUrl(navigator.serviceWorker.controller.scriptURL) : 'none'}`);
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      log(`SW registrations=${registrations.length}`);
      registrations.forEach(reg => log(`SW scope=${shortUrl(reg.scope)} active=${reg.active ? shortUrl(reg.active.scriptURL) : 'none'} waiting=${Boolean(reg.waiting)} installing=${Boolean(reg.installing)}`));
    } catch (error) {
      log(`SW inspect error ${error?.message || error}`);
    }
  }
  reportServiceWorker();
  navigator.serviceWorker?.addEventListener?.('controllerchange', () => log(`SW controllerchange -> ${navigator.serviceWorker.controller?.scriptURL ? shortUrl(navigator.serviceWorker.controller.scriptURL) : 'none'}`));

  function elementDetail(target) {
    if (target.tagName === 'LINK') return `rel=${target.rel || '-'} sheet=${target.sheet ? 'yes' : 'no'}`;
    if (target.tagName === 'SCRIPT') return `async=${Boolean(target.async)} defer=${Boolean(target.defer)}`;
    if (target.tagName === 'AUDIO' || target.tagName === 'VIDEO') return `networkState=${target.networkState} readyState=${target.readyState} preload=${target.preload || '-'}`;
    if (target.tagName === 'IMG') return `complete=${target.complete} natural=${target.naturalWidth}x${target.naturalHeight}`;
    return '';
  }

  setInterval(() => {
    const pendingImages = [...document.images].filter(img => img.src && !img.complete);
    const pendingElements = [...resourceStates.entries()].filter(([target, state]) => state.done === false && target.isConnected);
    log(`STATUS readyState=${document.readyState} imagesPending=${pendingImages.length} fetchPending=${pendingFetches.size} domPending=${pendingElements.length}`);
    pendingElements.slice(0, 12).forEach(([target, state]) => {
      log(`  DOM PENDING ${state.tag} ${(performance.now() - state.started).toFixed(0)}ms ${shortUrl(resourceUrl(target) || state.url)} ${elementDetail(target)}`);
    });
    [...pendingFetches.values()].filter(item => performance.now() - item.started >= 2000).slice(0, 8).forEach(item => {
      log(`  FETCH PENDING ${(performance.now() - item.started).toFixed(0)}ms ${shortUrl(item.url)}`);
    });
  }, 3000);
})();