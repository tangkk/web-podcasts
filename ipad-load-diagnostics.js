(() => {
  const ua = navigator.userAgent || '';
  const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIPad) return;

  const startedAt = performance.now();
  const lines = [];
  const pendingFetches = new Map();
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
    output.textContent = lines.slice(-120).join('\n');
    output.scrollTop = output.scrollHeight;
  }

  function log(message) {
    lines.push(`${elapsed()}  ${message}`);
    if (lines.length > 400) lines.splice(0, lines.length - 400);
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
      #ipadLoadDiagnosticsOutput{margin:0;min-height:280px;max-height:420px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;-webkit-overflow-scrolling:touch}
    `;
    document.head.appendChild(style);

    panel.querySelector('#ipadLoadDiagnosticsCopy')?.addEventListener('click', async event => {
      const text = lines.join('\n');
      try {
        await navigator.clipboard.writeText(text);
        event.currentTarget.textContent = '已复制';
        setTimeout(() => { event.currentTarget.textContent = '复制日志'; }, 1200);
      } catch {
        output?.focus?.();
        window.getSelection()?.selectAllChildren(output);
      }
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPanel, {once:true});
  } else {
    installPanel();
  }

  log(`boot readyState=${document.readyState}`);
  log(`UA ${ua}`);
  log(`platform=${navigator.platform} touch=${navigator.maxTouchPoints} online=${navigator.onLine}`);

  document.addEventListener('DOMContentLoaded', () => {
    log(`DOMContentLoaded readyState=${document.readyState}`);
  }, {once:true});

  window.addEventListener('load', () => {
    log(`WINDOW LOAD fired readyState=${document.readyState}`);
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      log(`NAV responseEnd=${nav.responseEnd.toFixed(0)} domContentLoaded=${nav.domContentLoadedEventEnd.toFixed(0)} loadEnd=${nav.loadEventEnd.toFixed(0)}`);
    }
  }, {once:true});

  window.addEventListener('error', event => {
    const target = event.target;
    if (target && target !== window && target.tagName) {
      log(`RESOURCE ERROR ${target.tagName} ${shortUrl(target.currentSrc || target.src || target.href || '')}`);
    } else {
      log(`JS ERROR ${event.message || 'unknown'} ${event.filename || ''}:${event.lineno || ''}`);
    }
  }, true);

  window.addEventListener('unhandledrejection', event => {
    log(`PROMISE ERROR ${String(event.reason?.message || event.reason || 'unknown')}`);
  });

  document.addEventListener('load', event => {
    const target = event.target;
    if (target?.tagName === 'IMG') {
      const started = Number(target.dataset.ipadDiagStartedAt || 0);
      if (started) {
        const duration = performance.now() - started;
        if (duration >= 1500) log(`IMG SLOW ${duration.toFixed(0)}ms ${shortUrl(target.currentSrc || target.src)}`);
      }
    }
  }, true);

  const markImages = root => {
    const images = root?.matches?.('img') ? [root] : [...(root?.querySelectorAll?.('img') || [])];
    images.forEach(img => {
      if (!img.dataset.ipadDiagStartedAt) img.dataset.ipadDiagStartedAt = String(performance.now());
    });
  };
  markImages(document);
  const imageObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) markImages(node);
    }));
  });
  imageObserver.observe(document.documentElement, {subtree:true, childList:true});

  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType !== 'resource') continue;
          if (entry.duration >= 1500) {
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
    if (!('serviceWorker' in navigator)) {
      log('SW unsupported');
      return;
    }
    log(`SW controller=${navigator.serviceWorker.controller?.scriptURL ? shortUrl(navigator.serviceWorker.controller.scriptURL) : 'none'}`);
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      log(`SW registrations=${registrations.length}`);
      registrations.forEach(reg => {
        log(`SW scope=${shortUrl(reg.scope)} active=${reg.active ? shortUrl(reg.active.scriptURL) : 'none'} waiting=${Boolean(reg.waiting)} installing=${Boolean(reg.installing)}`);
      });
    } catch (error) {
      log(`SW inspect error ${error?.message || error}`);
    }
  }
  reportServiceWorker();
  navigator.serviceWorker?.addEventListener?.('controllerchange', () => {
    log(`SW controllerchange -> ${navigator.serviceWorker.controller?.scriptURL ? shortUrl(navigator.serviceWorker.controller.scriptURL) : 'none'}`);
  });

  setInterval(() => {
    const pendingImages = [...document.images].filter(img => img.src && !img.complete);
    const oldFetches = [...pendingFetches.values()].filter(item => performance.now() - item.started >= 2000);
    log(`STATUS readyState=${document.readyState} imagesPending=${pendingImages.length} fetchPending=${pendingFetches.size}`);
    pendingImages.slice(0, 8).forEach(img => {
      const age = Number(img.dataset.ipadDiagStartedAt || 0);
      log(`  IMG PENDING ${age ? `${(performance.now() - age).toFixed(0)}ms ` : ''}${shortUrl(img.currentSrc || img.src)}`);
    });
    oldFetches.slice(0, 8).forEach(item => {
      log(`  FETCH PENDING ${(performance.now() - item.started).toFixed(0)}ms ${shortUrl(item.url)}`);
    });
  }, 3000);
})();