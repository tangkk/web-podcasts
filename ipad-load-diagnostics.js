(() => {
  const ua = navigator.userAgent || '';
  const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIPad) return;

  const startedAt = performance.now();
  const lines = [];
  const pendingFetches = new Map();
  const pendingXhrs = new Map();
  const resourceStates = new Map();
  let panel = null;
  let output = null;
  let sequence = 0;
  let lastResourceCount = 0;

  const elapsed = () => `${(performance.now() - startedAt).toFixed(0).padStart(6, ' ')}ms`;
  const shortUrl = value => {
    try {
      const url = new URL(String(value || ''), location.href);
      if (url.protocol === 'data:') return `${url.protocol}${String(value).slice(5, 45)}…`;
      return `${url.host}${url.pathname}${url.search}`;
    } catch {
      return String(value || '');
    }
  };

  function render() {
    if (!output) return;
    output.textContent = lines.slice(-260).join('\n');
    output.scrollTop = output.scrollHeight;
  }

  function log(message) {
    lines.push(`${elapsed()}  ${message}`);
    if (lines.length > 1200) lines.splice(0, lines.length - 1200);
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
        <strong>iPad Load Diagnostics v3</strong>
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
      #ipadLoadDiagnosticsOutput{margin:0;min-height:360px;max-height:620px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;-webkit-overflow-scrolling:touch}
    `;
    document.head.appendChild(style);

    const copyButton = panel.querySelector('#ipadLoadDiagnosticsCopy');
    copyButton?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        copyButton.textContent = '已复制';
        setTimeout(() => { if (copyButton.isConnected) copyButton.textContent = '复制日志'; }, 1200);
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
  log(`visibility=${document.visibilityState} focused=${document.hasFocus()}`);

  document.addEventListener('DOMContentLoaded', () => log(`DOMContentLoaded readyState=${document.readyState}`), {once:true});
  window.addEventListener('load', () => {
    log(`WINDOW LOAD fired readyState=${document.readyState}`);
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) log(`NAV responseEnd=${nav.responseEnd.toFixed(0)} domContentLoaded=${nav.domContentLoadedEventEnd.toFixed(0)} loadEnd=${nav.loadEventEnd.toFixed(0)}`);
  }, {once:true});

  window.addEventListener('pageshow', event => log(`PAGESHOW persisted=${event.persisted} visibility=${document.visibilityState}`));
  window.addEventListener('pagehide', event => log(`PAGEHIDE persisted=${event.persisted} visibility=${document.visibilityState}`));
  window.addEventListener('focus', () => log('WINDOW FOCUS'));
  window.addEventListener('blur', () => log('WINDOW BLUR'));
  document.addEventListener('visibilitychange', () => log(`VISIBILITY ${document.visibilityState}`));
  window.addEventListener('online', () => log('NETWORK online'));
  window.addEventListener('offline', () => log('NETWORK offline'));

  const resourceUrl = target => target?.currentSrc || target?.src || target?.href || '';
  const trackedTag = target => ['SCRIPT','LINK','IMG','AUDIO','VIDEO','IFRAME'].includes(target?.tagName);

  function markResource(target, reason = 'scan') {
    if (!trackedTag(target)) return;
    const url = resourceUrl(target);
    if (!url && !['AUDIO','VIDEO'].includes(target.tagName)) return;
    const existing = resourceStates.get(target);
    if (existing) {
      if (url && url !== existing.url) {
        log(`DOM URL CHANGE ${target.tagName} ${shortUrl(existing.url)} -> ${shortUrl(url)}`);
        existing.url = url;
        existing.started = performance.now();
        existing.done = false;
      }
      return;
    }
    resourceStates.set(target, {tag:target.tagName, started:performance.now(), url, done:false, outcome:'', reason});
    if (reason !== 'scan') log(`DOM ADD ${target.tagName} ${shortUrl(url)} reason=${reason}`);
  }

  function scanResources(root = document, reason = 'scan') {
    const selector = 'script[src],link[href],img,audio,video,iframe[src]';
    const nodes = root?.matches?.(selector) ? [root] : [...(root?.querySelectorAll?.(selector) || [])];
    nodes.forEach(node => markResource(node, reason));
  }

  scanResources(document);
  const domObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) scanResources(node, 'added');
      });
      if (mutation.type === 'attributes' && mutation.target?.nodeType === 1) {
        markResource(mutation.target, `attr:${mutation.attributeName}`);
      }
    });
  });
  domObserver.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['src','href','srcset','preload']});

  document.addEventListener('load', event => {
    const target = event.target;
    if (!trackedTag(target)) return;
    markResource(target, 'load');
    const state = resourceStates.get(target);
    if (!state) return;
    state.done = true;
    state.outcome = 'load';
    state.url = resourceUrl(target) || state.url;
    const duration = performance.now() - state.started;
    if (duration >= 1000) log(`${state.tag} LOAD ${duration.toFixed(0)}ms ${shortUrl(state.url)}`);
  }, true);

  window.addEventListener('error', event => {
    const target = event.target;
    if (target && target !== window && target.tagName) {
      markResource(target, 'error');
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
          if (entry.entryType !== 'resource') continue;
          log(`PERF RESOURCE ${entry.initiatorType || '-'} ${entry.duration.toFixed(0)}ms transfer=${entry.transferSize || 0} ${shortUrl(entry.name)}`);
        }
      });
      observer.observe({type:'resource', buffered:true});
    } catch (error) {
      log(`PERF OBSERVER ERROR ${error?.message || error}`);
    }
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function ipadDiagnosticFetch(input, init) {
    const id = ++sequence;
    const rawUrl = typeof input === 'string' || input instanceof URL ? input : input?.url;
    const started = performance.now();
    pendingFetches.set(id, {url:rawUrl, started});
    log(`FETCH START #${id} ${shortUrl(rawUrl)}`);
    try {
      const response = await nativeFetch(input, init);
      log(`FETCH END #${id} ${(performance.now() - started).toFixed(0)}ms HTTP ${response.status} ${shortUrl(rawUrl)}`);
      return response;
    } catch (error) {
      log(`FETCH ERROR #${id} ${(performance.now() - started).toFixed(0)}ms ${shortUrl(rawUrl)} ${error?.message || error}`);
      throw error;
    } finally {
      pendingFetches.delete(id);
    }
  };

  if ('XMLHttpRequest' in window) {
    const nativeOpen = XMLHttpRequest.prototype.open;
    const nativeSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this.__ipadDiag = {method, url, id:++sequence};
      return nativeOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(...args) {
      const info = this.__ipadDiag || {method:'?', url:'?', id:++sequence};
      const started = performance.now();
      pendingXhrs.set(info.id, {url:info.url, started, method:info.method});
      log(`XHR START #${info.id} ${info.method} ${shortUrl(info.url)}`);
      const finish = kind => {
        if (!pendingXhrs.has(info.id)) return;
        log(`XHR ${kind} #${info.id} ${(performance.now() - started).toFixed(0)}ms status=${this.status || 0} ${shortUrl(info.url)}`);
        pendingXhrs.delete(info.id);
      };
      this.addEventListener('loadend', () => finish('END'), {once:true});
      this.addEventListener('error', () => finish('ERROR'), {once:true});
      this.addEventListener('abort', () => finish('ABORT'), {once:true});
      return nativeSend.apply(this, args);
    };
  }

  async function reportServiceWorker(prefix = 'SW') {
    if (!('serviceWorker' in navigator)) return log(`${prefix} unsupported`);
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const controller = navigator.serviceWorker.controller;
      log(`${prefix} controller=${controller?.scriptURL ? shortUrl(controller.scriptURL) : 'none'} regs=${registrations.length}`);
      registrations.forEach(reg => {
        log(`${prefix} REG scope=${shortUrl(reg.scope)} active=${reg.active ? shortUrl(reg.active.scriptURL) : 'none'} waiting=${Boolean(reg.waiting)} installing=${Boolean(reg.installing)}`);
      });
    } catch (error) {
      log(`${prefix} inspect error ${error?.message || error}`);
    }
  }
  reportServiceWorker();
  navigator.serviceWorker?.addEventListener?.('controllerchange', () => {
    log(`SW controllerchange -> ${navigator.serviceWorker.controller?.scriptURL ? shortUrl(navigator.serviceWorker.controller.scriptURL) : 'none'}`);
    reportServiceWorker('SW CHANGE');
  });

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
    const resources = performance.getEntriesByType('resource');
    const newResources = Math.max(0, resources.length - lastResourceCount);
    lastResourceCount = resources.length;
    const nav = performance.getEntriesByType('navigation')[0];
    log(`STATUS readyState=${document.readyState} visibility=${document.visibilityState} focused=${document.hasFocus()} imagesPending=${pendingImages.length} fetchPending=${pendingFetches.size} xhrPending=${pendingXhrs.size} domPending=${pendingElements.length} resources=${resources.length} newResources=${newResources} navLoadEnd=${nav?.loadEventEnd?.toFixed?.(0) || 0}`);
    pendingElements.slice(0, 10).forEach(([target, state]) => {
      log(`  DOM PENDING ${state.tag} ${(performance.now() - state.started).toFixed(0)}ms ${shortUrl(resourceUrl(target) || state.url)} ${elementDetail(target)}`);
    });
    [...pendingFetches.values()].filter(item => performance.now() - item.started >= 1500).slice(0, 6).forEach(item => {
      log(`  FETCH PENDING ${(performance.now() - item.started).toFixed(0)}ms ${shortUrl(item.url)}`);
    });
    [...pendingXhrs.values()].filter(item => performance.now() - item.started >= 1500).slice(0, 6).forEach(item => {
      log(`  XHR PENDING ${(performance.now() - item.started).toFixed(0)}ms ${item.method} ${shortUrl(item.url)}`);
    });
    if (Math.round(performance.now() - startedAt) % 15000 < 3000) reportServiceWorker('SW POLL');
  }, 3000);
})();