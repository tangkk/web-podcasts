(() => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./artwork-cache-sw.js', { scope: './' }).catch(() => {});
  });
})();
