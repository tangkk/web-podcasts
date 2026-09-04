(() => {
  const tabs = () => [...document.querySelectorAll('.view-tabs .view-tab[data-view]')];

  function enforce(preferred) {
    const list = tabs();
    if (!list.length) return;

    let target = null;
    if (preferred) target = list.find(tab => tab.dataset.view === preferred) || null;
    if (!target) target = list.find(tab => tab.classList.contains('active')) || list[0];

    list.forEach(tab => {
      const active = tab === target;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('.view-tabs .view-tab[data-view]');
    if (!tab) return;
    const view = tab.dataset.view;
    requestAnimationFrame(() => enforce(view));
  }, true);

  const observer = new MutationObserver(() => {
    const active = tabs().filter(tab => tab.classList.contains('active'));
    if (active.length <= 1) return;
    enforce(active[active.length - 1]?.dataset.view);
  });

  const host = document.querySelector('.view-tabs');
  if (host) observer.observe(host, {subtree:true, attributes:true, attributeFilter:['class','aria-selected'], childList:true});

  window.addEventListener('debug-playlist-change', () => {
    if (document.querySelector('.view-tab[data-view="playlist"].active')) enforce('playlist');
  });

  enforce();
})();
