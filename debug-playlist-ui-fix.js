(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const viewbar = document.querySelector('.viewbar');
  if (!viewbar) return;

  const alignSync = () => {
    document.querySelectorAll('.debug-playlist-sync').forEach(button => button.remove());

    viewbar.querySelectorAll('button').forEach(button => {
      if (button.textContent.trim() !== '同步') return;
      button.classList.add('debug-existing-sync-aligned');
    });
  };

  const style = document.createElement('style');
  style.textContent = `
    .debug-existing-sync-aligned {
      align-self: center;
      border: 0 !important;
      border-bottom: 2px solid transparent !important;
      border-radius: 0 !important;
      padding: 7px 0 !important;
      background: transparent !important;
      color: var(--muted) !important;
      font-size: 13px !important;
      line-height: normal !important;
      font-weight: 400 !important;
      cursor: pointer;
    }
    .debug-existing-sync-aligned:hover {
      color: var(--ink) !important;
    }
  `;
  document.head.appendChild(style);

  alignSync();
  new MutationObserver(alignSync).observe(viewbar, {childList:true, subtree:true, characterData:true});
})();
