const els = {
  search: document.querySelector('#searchInput'),
  languageFilters: document.querySelector('#languageFilters'),
  categoryFilters: document.querySelector('#categoryFilters'),
  directory: document.querySelector('#directory'),
  resultCount: document.querySelector('#resultCount'),
  updatedAt: document.querySelector('#updatedAt'),
  catalogTotal: document.querySelector('#catalogTotal'),
  favoritesToggle: document.querySelector('#favoritesToggle'),
  viewTabs: [...document.querySelectorAll('.view-tab')],
  player: document.querySelector('#player'),
  audio: document.querySelector('#audio'),
  artwork: document.querySelector('#playerArtwork'),
  nowShow: document.querySelector('#nowShow'),
  nowTitle: document.querySelector('#nowTitle'),
  play: document.querySelector('#playToggle'),
  back: document.querySelector('#skipBack'),
  forward: document.querySelector('#skipForward'),
  seek: document.querySelector('#seekControl'),
  currentTime: document.querySelector('#currentTime'),
  duration: document.querySelector('#duration'),
  speed: document.querySelector('#speedToggle'),
  volume: document.querySelector('#volumeControl'),
  close: document.querySelector('#closePlayer'),
  debugToggle: document.querySelector('#debugToggle'),
  debugPanel: document.querySelector('#debugPanel'),
  debugLog: document.querySelector('#debugLog'),
  clearDebug: document.querySelector('#clearDebug')
};

const state = {
  shows: [],
  language: '全部',
  category: '全部',
  query: '',
  view: 'episodes',
  favoritesOnly: false,
  favorites: new Set(JSON.parse(localStorage.getItem('web-podcasts:favorites') || '[]')),
  current: null,
  speedIndex: 1,
  detailShow: null,
  detailVisible: 20
};
const speeds = [0.8, 1, 1.2, 1.5, 2];

const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const normalize = value => String(value || '').toLocaleLowerCase().normalize('NFKC');
const formatDate = value => value ? new Intl.DateTimeFormat('zh-Hant', {month:'short', day:'numeric'}).format(new Date(value)) : '日期未提供';
const formatTime = seconds => {
  if (!Number.isFinite(seconds)) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  return hours ? `${hours}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}` : `${minutes}:${String(rest).padStart(2,'0')}`;
};
const durationLabel = value => {
  if (!value) return '';
  if (value.includes(':')) return value;
  return formatTime(Number(value));
};
const log = (message, detail) => {
  const line = `[${new Date().toLocaleTimeString('zh-Hant', {hour12:false})}] ${message}${detail ? ` · ${JSON.stringify(detail)}` : ''}`;
  els.debugLog.textContent += `${line}\n`;
  els.debugLog.scrollTop = els.debugLog.scrollHeight;
};

function makeFilters(container, values, active, setter) {
  container.innerHTML = values.map(value => `<button class="chip${value === active ? ' active' : ''}" type="button" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join('');
  container.querySelectorAll('.chip').forEach(button => button.addEventListener('click', () => setter(button.dataset.value)));
}

function renderFilters() {
  makeFilters(els.languageFilters, ['全部', '華語', 'English'], state.language, value => { state.language = value; render(); });
  makeFilters(els.categoryFilters, ['全部', '新聞時事', '商業科技', '社會文化', '歷史知識', '科學健康', '故事娛樂'], state.category, value => { state.category = value; render(); });
}

function filteredShows() {
  const query = normalize(state.query);
  return state.shows.filter(show => {
    const languageMatch = state.language === '全部' || (state.language === '華語' ? show.language !== 'English' : show.language === 'English');
    const categoryMatch = state.category === '全部' || show.category === state.category;
    const favoriteMatch = !state.favoritesOnly || state.favorites.has(show.id);
    const haystack = normalize([show.name, show.publisher, show.region, show.description, ...show.episodes.map(episode => episode.title)].join(' '));
    return languageMatch && categoryMatch && favoriteMatch && (!query || haystack.includes(query));
  });
}

function episodeCard(show, episode) {
  const active = state.current?.showId === show.id && state.current?.episodeId === episode.id;
  return `<article class="episode${active ? ' is-playing' : ''}" data-show-id="${escapeHtml(show.id)}" data-episode-id="${escapeHtml(episode.id)}">
    <img class="artwork" src="${escapeHtml(show.artwork)}" alt="" loading="lazy" referrerpolicy="no-referrer">
    <div class="card-copy">
      <button class="show-name open-show" type="button">${escapeHtml(show.name)}</button>
      <h2 class="episode-title">${escapeHtml(episode.title)}</h2>
      <div class="card-meta"><span>${formatDate(episode.publishedAt)}</span>${durationLabel(episode.duration) ? `<span>${escapeHtml(durationLabel(episode.duration))}</span>` : ''}<span>${escapeHtml(show.language)}</span></div>
    </div>
    <div class="card-actions">
      <button class="play-card" type="button">${active && !els.audio.paused ? '暫停' : '播放'}</button>
      <button class="favorite${state.favorites.has(show.id) ? ' active' : ''}" type="button" aria-label="收藏 ${escapeHtml(show.name)}" title="收藏">${state.favorites.has(show.id) ? '★' : '☆'}</button>
    </div>
  </article>`;
}

function showCard(show) {
  return `<article class="show-card" data-show-id="${escapeHtml(show.id)}">
    <img class="artwork" src="${escapeHtml(show.artwork)}" alt="" loading="lazy" referrerpolicy="no-referrer">
    <div class="card-copy">
      <div class="show-name">${escapeHtml(show.publisher)}</div>
      <button class="show-title open-show" type="button">${escapeHtml(show.name)}</button>
      <div class="card-meta"><span>${escapeHtml(show.region)}</span><span>${escapeHtml(show.category)}</span><span>${show.episodes.length} 集</span></div>
      <div class="show-description">${escapeHtml(show.description)}</div>
    </div>
    <div class="card-actions">
      <button class="play-card" type="button">最新一集</button>
      <button class="favorite${state.favorites.has(show.id) ? ' active' : ''}" type="button" aria-label="收藏 ${escapeHtml(show.name)}">${state.favorites.has(show.id) ? '★' : '☆'}</button>
    </div>
  </article>`;
}

function bindCards() {
  els.directory.querySelectorAll('article[data-show-id]').forEach(card => {
    const show = state.detailShow?.id === card.dataset.showId ? state.detailShow : state.shows.find(item => item.id === card.dataset.showId);
    const episode = card.dataset.episodeId ? show?.episodes.find(item => item.id === card.dataset.episodeId) : show?.episodes[0];
    card.querySelector('.play-card')?.addEventListener('click', () => episode && toggleEpisode(show, episode));
    card.querySelector('.favorite')?.addEventListener('click', () => toggleFavorite(show.id));
    card.querySelector('.open-show')?.addEventListener('click', () => openShow(show.id));
  });
}

function renderDetail() {
  const show = state.detailShow;
  const episodes = show.episodes.slice(0, state.detailVisible);
  document.body.classList.add('detail-open');
  els.resultCount.textContent = `${show.episodes.length} 個可用歷史單集`;
  els.directory.innerHTML = `<section class="show-detail">
    <button id="backToDirectory" class="back-button" type="button">← 返回目錄</button>
    <header class="detail-header">
      <img class="detail-artwork" src="${escapeHtml(show.artwork)}" alt="" referrerpolicy="no-referrer">
      <div>
        <div class="show-name">${escapeHtml(show.publisher)}</div>
        <h2>${escapeHtml(show.name)}</h2>
        <div class="detail-meta">${escapeHtml(show.region)} · ${escapeHtml(show.language)} · ${escapeHtml(show.category)}</div>
        <p>${escapeHtml(show.description)}</p>
        <button class="favorite detail-favorite${state.favorites.has(show.id) ? ' active' : ''}" type="button">${state.favorites.has(show.id) ? '★ 已收藏' : '☆ 收藏節目'}</button>
      </div>
    </header>
    <div class="detail-list">${episodes.map(episode => episodeCard(show, episode)).join('')}</div>
    ${episodes.length < show.episodes.length ? `<button id="loadMore" class="load-more" type="button">載入更多（${show.episodes.length - episodes.length}）</button>` : ''}
  </section>`;
  document.querySelector('#backToDirectory').addEventListener('click', closeShow);
  document.querySelector('.detail-favorite').addEventListener('click', () => toggleFavorite(show.id));
  document.querySelector('#loadMore')?.addEventListener('click', () => { state.detailVisible += 20; renderDetail(); });
  bindCards();
}

async function openShow(id, updateHash = true) {
  const summary = state.shows.find(show => show.id === id);
  if (!summary) return;
  state.detailVisible = 20;
  document.body.classList.add('detail-open');
  els.directory.innerHTML = '<div class="empty">正在載入歷史單集…</div>';
  if (updateHash) history.pushState(null, '', `#show=${encodeURIComponent(id)}`);
  try {
    const response = await fetch(`./shows/${encodeURIComponent(id)}.json`, {cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.detailShow = await response.json();
    renderDetail();
  } catch (error) {
    document.body.classList.remove('detail-open');
    state.detailShow = null;
    log('History load error', {show:id, message:error.message});
    els.directory.innerHTML = `<div class="empty">歷史單集載入失敗：${escapeHtml(error.message)}<br><button id="backToDirectory" class="back-button" type="button">返回目錄</button></div>`;
    document.querySelector('#backToDirectory').addEventListener('click', closeShow);
  }
}

function closeShow() {
  state.detailShow = null;
  document.body.classList.remove('detail-open');
  if (location.hash.startsWith('#show=')) history.pushState(null, '', location.pathname + location.search);
  render();
}

function render() {
  if (state.detailShow) { renderDetail(); return; }
  document.body.classList.remove('detail-open');
  renderFilters();
  const shows = filteredShows();
  if (state.view === 'episodes') {
    const episodes = shows.flatMap(show => show.episodes.slice(0, 3).map(episode => ({show, episode})))
      .sort((a,b) => new Date(b.episode.publishedAt || 0) - new Date(a.episode.publishedAt || 0))
      .slice(0, 120);
    els.directory.innerHTML = episodes.length ? episodes.map(({show, episode}) => episodeCard(show, episode)).join('') : '<div class="empty">沒有符合條件的單集。</div>';
    els.resultCount.textContent = `${episodes.length} 個最新單集・來自 ${shows.length} 個節目`;
  } else {
    els.directory.innerHTML = shows.length ? shows.map(showCard).join('') : '<div class="empty">沒有符合條件的節目。</div>';
    els.resultCount.textContent = `${shows.length} 個節目`;
  }
  els.favoritesToggle.classList.toggle('active', state.favoritesOnly);
  els.favoritesToggle.setAttribute('aria-pressed', String(state.favoritesOnly));
  bindCards();
}

function toggleFavorite(id) {
  state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
  localStorage.setItem('web-podcasts:favorites', JSON.stringify([...state.favorites]));
  render();
}

async function toggleEpisode(show, episode) {
  const same = state.current?.showId === show.id && state.current?.episodeId === episode.id;
  if (same && !els.audio.paused) { els.audio.pause(); return; }
  if (!same) {
    state.current = {showId: show.id, episodeId: episode.id};
    els.player.hidden = false;
    els.artwork.src = show.artwork;
    els.nowShow.textContent = show.name;
    els.nowTitle.textContent = episode.title;
    els.audio.src = episode.audio;
    els.audio.load();
    log('Episode selected', {show: show.name, episode: episode.title, audio: episode.audio});
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({title: episode.title, artist: show.name, album: show.publisher, artwork: show.artwork ? [{src: show.artwork}] : []});
    }
  }
  try { await els.audio.play(); } catch (error) { log('Play rejected', {name:error.name, message:error.message}); }
}

function syncPlayer() {
  els.play.textContent = els.audio.paused ? '▶' : '❚❚';
  els.play.setAttribute('aria-label', els.audio.paused ? '播放' : '暫停');
  els.currentTime.textContent = formatTime(els.audio.currentTime);
  els.duration.textContent = formatTime(els.audio.duration);
  els.seek.value = Number.isFinite(els.audio.duration) && els.audio.duration ? String(els.audio.currentTime / els.audio.duration * 100) : '0';
}

els.search.addEventListener('input', event => { state.query = event.target.value.trim(); render(); });
document.addEventListener('keydown', event => {
  if (event.key === '/' && document.activeElement !== els.search) { event.preventDefault(); els.search.focus(); }
  if (event.code === 'Space' && !['INPUT','BUTTON'].includes(document.activeElement?.tagName) && !els.player.hidden) { event.preventDefault(); els.audio.paused ? els.audio.play() : els.audio.pause(); }
});
els.viewTabs.forEach(tab => tab.addEventListener('click', () => {
  state.view = tab.dataset.view;
  els.viewTabs.forEach(item => { const active = item === tab; item.classList.toggle('active', active); item.setAttribute('aria-selected', String(active)); });
  render();
}));
els.favoritesToggle.addEventListener('click', () => { state.favoritesOnly = !state.favoritesOnly; render(); });
els.play.addEventListener('click', () => state.current && (els.audio.paused ? els.audio.play() : els.audio.pause()));
els.back.addEventListener('click', () => { els.audio.currentTime = Math.max(0, els.audio.currentTime - 15); });
els.forward.addEventListener('click', () => { els.audio.currentTime = Math.min(els.audio.duration || Infinity, els.audio.currentTime + 30); });
els.seek.addEventListener('input', () => { if (Number.isFinite(els.audio.duration)) els.audio.currentTime = Number(els.seek.value) / 100 * els.audio.duration; });
els.speed.addEventListener('click', () => { state.speedIndex = (state.speedIndex + 1) % speeds.length; els.audio.playbackRate = speeds[state.speedIndex]; els.speed.textContent = `${speeds[state.speedIndex]}×`; });
els.volume.addEventListener('input', () => { els.audio.volume = Number(els.volume.value); localStorage.setItem('web-podcasts:volume', els.volume.value); });
els.close.addEventListener('click', () => { els.audio.pause(); els.audio.removeAttribute('src'); els.player.hidden = true; state.current = null; render(); });
els.debugToggle.addEventListener('click', () => { els.debugPanel.hidden = !els.debugPanel.hidden; els.debugToggle.setAttribute('aria-expanded', String(!els.debugPanel.hidden)); });
els.clearDebug.addEventListener('click', () => { els.debugLog.textContent = ''; });
['loadedmetadata','durationchange','timeupdate'].forEach(event => els.audio.addEventListener(event, syncPlayer));
['play','pause','ended'].forEach(event => els.audio.addEventListener(event, () => { syncPlayer(); render(); }));
['waiting','stalled','canplay'].forEach(event => els.audio.addEventListener(event, () => log(`Audio ${event}`, {readyState:els.audio.readyState, networkState:els.audio.networkState})));
els.audio.addEventListener('error', () => log('Audio error', {code:els.audio.error?.code, message:els.audio.error?.message, src:els.audio.currentSrc}));
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => els.audio.play());
  navigator.mediaSession.setActionHandler('pause', () => els.audio.pause());
  navigator.mediaSession.setActionHandler('seekbackward', detail => { els.audio.currentTime = Math.max(0, els.audio.currentTime - (detail.seekOffset || 15)); });
  navigator.mediaSession.setActionHandler('seekforward', detail => { els.audio.currentTime = Math.min(els.audio.duration || Infinity, els.audio.currentTime + (detail.seekOffset || 30)); });
}

async function init() {
  const storedVolume = Number(localStorage.getItem('web-podcasts:volume'));
  if (Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 1) { els.audio.volume = storedVolume; els.volume.value = String(storedVolume); }
  try {
    const response = await fetch('./episodes.json', {cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.shows = data.shows.filter(show => show.episodes?.length);
    els.updatedAt.textContent = `更新 ${new Intl.DateTimeFormat('zh-Hant', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(data.generatedAt))}`;
    els.catalogTotal.textContent = `${state.shows.length} SHOWS・${data.episodeCount} EPISODES`;
    log('Catalog loaded', {shows:state.shows.length, episodes:data.episodeCount});
    render();
    const hashId = location.hash.startsWith('#show=') ? decodeURIComponent(location.hash.slice(6)) : '';
    if (hashId) openShow(hashId, false);
  } catch (error) {
    els.resultCount.textContent = '目錄暫時無法載入';
    els.directory.innerHTML = `<div class="empty">載入失敗：${escapeHtml(error.message)}</div>`;
    log('Catalog error', {message:error.message});
  }
}

window.addEventListener('popstate', () => {
  const hashId = location.hash.startsWith('#show=') ? decodeURIComponent(location.hash.slice(6)) : '';
  if (hashId) openShow(hashId, false);
  else if (state.detailShow) { state.detailShow = null; render(); }
});

init();
