(() => {
  const player = document.querySelector('#player');
  const seek = document.querySelector('#seekControl');
  if (!player) return;

  const mobileQuery = window.matchMedia('(max-width: 560px)');

  function setExpanded(expanded) {
    if (!mobileQuery.matches) expanded = false;
    player.classList.toggle('mobile-expanded', expanded);
    player.setAttribute('aria-expanded', String(expanded));
  }

  player.addEventListener('click', event => {
    if (!mobileQuery.matches || player.hidden) return;
    if (event.target.closest('button, input, label, a, .timeline, .debug-panel')) return;
    setExpanded(!player.classList.contains('mobile-expanded'));
  });

  seek?.addEventListener('pointerdown', event => {
    if (!mobileQuery.matches) return;
    setExpanded(true);
    if (event.pointerType === 'touch') event.stopPropagation();
  });

  mobileQuery.addEventListener?.('change', event => {
    if (!event.matches) setExpanded(false);
  });
})();
