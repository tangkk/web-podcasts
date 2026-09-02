(() => {
  const audio = document.querySelector('#audio');
  const volume = document.querySelector('#volumeControl');
  if (!audio || !volume) return;

  const desktopPointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
  const interactiveTags = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);

  function isDesktop() {
    return desktopPointer ? desktopPointer.matches : window.innerWidth >= 768;
  }

  function shouldIgnore(event) {
    if (!isDesktop()) return true;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return true;
    const target = event.target;
    return Boolean(target?.isContentEditable || interactiveTags.has(target?.tagName));
  }

  function changeVolume(direction) {
    const step = Number(volume.step || 0.05) || 0.05;
    const min = Number(volume.min || 0);
    const max = Number(volume.max || 1);
    const next = Math.min(max, Math.max(min, Math.round((Number(volume.value) + direction * step) * 100) / 100));
    volume.value = String(next);
    audio.volume = next;
    volume.dispatchEvent(new Event('input', { bubbles: true }));
  }

  document.addEventListener('keydown', event => {
    if (shouldIgnore(event)) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    changeVolume(event.key === 'ArrowRight' ? 1 : -1);
  });
})();
