(() => {
  const STORAGE_KEY = 'web-podcasts:reverse-autoplay';
  const button = document.querySelector('#playbackOrderToggle');
  if (!button) return;

  function isReversed() {
    return localStorage.getItem(STORAGE_KEY) === '1';
  }

  function render() {
    const reversed = isReversed();
    button.textContent = reversed ? '舊→新' : '新→舊';
    button.classList.toggle('active', reversed);
    button.setAttribute('aria-pressed', String(reversed));
    button.setAttribute('aria-label', reversed ? '自動播放順序：由舊到新' : '自動播放順序：由新到舊');
  }

  window.webPodcastsReverseAutoplay = isReversed;

  button.addEventListener('click', () => {
    const reversed = !isReversed();
    localStorage.setItem(STORAGE_KEY, reversed ? '1' : '0');
    render();
    document.dispatchEvent(new CustomEvent('web-podcasts:playback-order-change', { detail: { reversed } }));
  });

  render();
})();
