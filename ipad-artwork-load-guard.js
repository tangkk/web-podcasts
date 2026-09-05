(() => {
  const ua = navigator.userAgent || '';
  const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIPad) return;

  let pageLoaded = document.readyState === 'complete';

  function deferImage(img) {
    if (!img?.classList?.contains('ipad-deferred-artwork')) return;
    const raw = img.getAttribute('src');
    if (!raw) return;
    if (!raw.startsWith('data:image/gif') && !pageLoaded) {
      if (!img.dataset.artworkSrc) img.dataset.artworkSrc = raw;
      img.removeAttribute('src');
      return;
    }
    if (raw.startsWith('data:image/gif')) img.removeAttribute('src');
  }

  function hydrateVisible() {
    if (!pageLoaded) return;
    document.querySelectorAll('img.ipad-deferred-artwork[data-artwork-src]').forEach(img => {
      if (img.getAttribute('src')) return;
      const rect = img.getBoundingClientRect();
      if (rect.bottom < -600 || rect.top > innerHeight + 600) return;
      const src = img.dataset.artworkSrc;
      if (src) img.src = src;
    });
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        deferImage(mutation.target);
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('img.ipad-deferred-artwork')) deferImage(node);
        node.querySelectorAll?.('img.ipad-deferred-artwork').forEach(deferImage);
      }
    }
    hydrateVisible();
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src']
  });

  window.addEventListener('load', () => {
    pageLoaded = true;
    hydrateVisible();
  }, {once:true});

  window.addEventListener('scroll', hydrateVisible, {passive:true});
  window.addEventListener('resize', hydrateVisible, {passive:true});
})();
