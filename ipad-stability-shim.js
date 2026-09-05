(() => {
  const ua = navigator.userAgent || '';
  const isIPadFamily = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIPadFamily) return;

  // Preserve the tiny scheduling perturbation that made the intermittent
  // iPad WebKit load race disappear, without diagnostics, logging, timers,
  // DOM scans, or a visible panel.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function ipadStableFetch(input, init) {
    return await nativeFetch(input, init);
  };

  // A no-op observer keeps the same MutationObserver checkpoint behavior
  // as the diagnostic build with negligible work in the callback.
  const observer = new MutationObserver(() => {});
  observer.observe(document.documentElement, {subtree:true, childList:true});
  window.addEventListener('pagehide', () => observer.disconnect(), {once:true});

  // Match the diagnostic build's harmless early SW registration query.
  navigator.serviceWorker?.getRegistrations?.().catch(() => {});
})();