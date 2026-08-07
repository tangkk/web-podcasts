(() => {
  const nowShow = document.querySelector('#nowShow');
  if (!nowShow) return;

  nowShow.addEventListener('click', event => {
    event.stopPropagation();
    if (typeof state === 'undefined' || !state.current?.showId || typeof openShow !== 'function') return;
    openShow(state.current.showId).catch?.(() => {});
  });
})();
