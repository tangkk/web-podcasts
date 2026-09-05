(() => {
  const STREAM_KEY = 'web-podcasts:stream:v1';
  const FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const ORDER_KEY = 'web-podcasts:reverse-autoplay';
  const directory = document.querySelector('#directory');
  if (!directory) return;

  const showCache = new Map();
  let expanding = false;

  const normalize = value => String(value || '').toLocaleLowerCase().normalize('NFKC').trim();
  const parseDuration = value => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parts = String(value || '').split(':').map(Number);
    if (!parts.length || parts.some(Number.isNaN)) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
  };

  const readQueue = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STREAM_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const currentFilter = () => localStorage.getItem(FILTER_KEY) || '';
  const matchesFilter = item => {
    const query = normalize(currentFilter());
    return !query || normalize(item?.title).includes(query);
  };

  const saveQueue = queue => {
    localStorage.setItem(STREAM_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('stream-change'));
  };

  const setFilter = value => {
    localStorage.setItem(FILTER_KEY, value);
    window.dispatchEvent(new CustomEvent('stream-filter-change', {detail:{value}}));
  };

  async function loadShow(showId) {
    if (showCache.has(showId)) return showCache.get(showId);
    const response = await fetch(`./shows/${encodeURIComponent(showId)}.json`, {cache:'no-store'});
    if (!response.ok) throw new Error(`show HTTP ${response.status}`);
    const show = await response.json();
    showCache.set(showId, show);
    return show;
  }

  const orderedEpisodes = show => {
    const reversed = localStorage.getItem(ORDER_KEY) === '1';
    return [...(show.episodes || [])].sort((a, b) => {
      const at = new Date(a.publishedAt || 0).getTime();
      const bt = new Date(b.publishedAt || 0).getTime();
      return reversed ? at - bt : bt - at;
    });
  };

  const toItem = (show, episode) => ({
    key: `${show.id}:${episode.id}`,
    showId: show.id,
    episodeId: episode.id,
    showName: show.name || '',
    title: episode.title || '',
    audio: episode.audio,
    artwork: show.artwork || '',
    publisher: show.publisher || '',
    duration: episode.duration,
    durationSeconds: parseDuration(episode.duration)
  });

  async function doubleStream(button) {
    if (expanding) return;
    const queue = readQueue();
    if (!queue.length) return;

    expanding = true;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = '…';

    try {
      const target = queue.length * 2;
      const result = [...queue];
      const existing = new Set(result.map(item => item.key));
      const showIds = [...new Set(queue.map(item => item.showId).filter(Boolean))];
      const sources = [];

      for (const showId of showIds) {
        const show = await loadShow(showId);
        const ordered = orderedEpisodes(show);
        const positions = queue
          .filter(item => item.showId === showId)
          .map(item => ordered.findIndex(episode => episode.id === item.episodeId))
          .filter(index => index >= 0);
        const start = positions.length ? Math.max(...positions) + 1 : 0;
        sources.push({show, ordered, cursor:start});
      }

      let addedThisPass = true;
      while (result.length < target && addedThisPass) {
        addedThisPass = false;
        for (const source of sources) {
          while (source.cursor < source.ordered.length) {
            const episode = source.ordered[source.cursor++];
            const item = toItem(source.show, episode);
            if (existing.has(item.key)) continue;
            if (typeof item.audio !== 'string' || !item.audio.startsWith('https://')) continue;
            if (!Number.isFinite(item.durationSeconds) || item.durationSeconds <= 0) continue;
            result.push(item);
            existing.add(item.key);
            addedThisPass = true;
            break;
          }
          if (result.length >= target) break;
        }
      }

      saveQueue(result);
    } catch (error) {
      console.warn('Stream double failed', error);
      button.textContent = '!';
      setTimeout(() => { button.textContent = original; }, 900);
    } finally {
      expanding = false;
      button.disabled = false;
      if (button.textContent === '…') button.textContent = original;
    }
  }

  function applyFilter() {
    const queue = readQueue();
    const byKey = new Map(queue.map(item => [item.key, item]));
    let visible = 0;

    document.querySelectorAll('.stream-row[data-queue-key]').forEach(row => {
      const item = byKey.get(row.dataset.queueKey);
      const show = !!item && matchesFilter(item);
      row.hidden = !show;
      if (show) visible += 1;
    });

    const count = document.querySelector('.stream-toolbar [data-stream-count]');
    if (count) count.textContent = currentFilter() ? `${visible} / ${queue.length} 个单集` : `${queue.length} 个单集`;

    const resultCount = document.querySelector('#resultCount');
    if (resultCount && document.querySelector('.view-tab[data-view="playlist"].active')) {
      resultCount.textContent = currentFilter() ? `${visible} 个筛选结果 · 原流 ${queue.length} 集` : `${queue.length} 个播放列表单集`;
    }

    const start = document.querySelector('#streamStart');
    if (start && !audioPlayingSingle()) start.disabled = visible === 0;
  }

  function audioPlayingSingle() {
    const audio = document.querySelector('#audio');
    return !!audio && audio.dataset.playlistMode === 'stream-single' && !audio.paused && !audio.ended;
  }

  function ensureControls() {
    const view = document.querySelector('.stream-view[data-stream-view="1"]');
    const toolbar = view?.querySelector('.stream-toolbar');
    if (!view || !toolbar) return;

    let count = toolbar.querySelector('div:first-child span');
    if (count) count.dataset.streamCount = '1';

    let filterBar = view.querySelector('.stream-filter-bar');
    if (!filterBar) {
      filterBar = document.createElement('div');
      filterBar.className = 'stream-filter-bar';
      filterBar.innerHTML = `
        <label class="stream-filter-field">
          <span>标题筛选</span>
          <input id="streamTitleFilter" type="search" placeholder="输入标题关键词" autocomplete="off">
        </label>
        <button id="streamDouble" type="button" title="将当前流容量翻倍">×2</button>
      `;
      toolbar.after(filterBar);

      const input = filterBar.querySelector('#streamTitleFilter');
      input.value = currentFilter();
      input.addEventListener('input', () => {
        setFilter(input.value);
        applyFilter();
      });

      filterBar.querySelector('#streamDouble').addEventListener('click', event => {
        doubleStream(event.currentTarget);
      });
    } else {
      const input = filterBar.querySelector('#streamTitleFilter');
      if (input && document.activeElement !== input && input.value !== currentFilter()) input.value = currentFilter();
    }

    applyFilter();
  }

  window.addEventListener('stream-change', () => requestAnimationFrame(ensureControls));
  window.addEventListener('stream-filter-change', () => requestAnimationFrame(applyFilter));
  window.addEventListener('storage', event => {
    if (event.key === STREAM_KEY || event.key === FILTER_KEY) requestAnimationFrame(ensureControls);
  });

  const observer = new MutationObserver(mutations => {
    if (!mutations.some(m => [...m.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('.stream-view') || node.querySelector?.('.stream-view'))))) return;
    requestAnimationFrame(ensureControls);
  });
  observer.observe(directory, {subtree:true, childList:true});

  const style = document.createElement('style');
  style.textContent = `
    .stream-filter-bar{display:flex;align-items:end;gap:8px;padding:2px 0 10px;border-bottom:1px solid var(--line)}
    .stream-filter-field{display:grid;gap:4px;flex:1;min-width:0}
    .stream-filter-field span{font-size:10px;color:var(--muted);letter-spacing:.04em}
    .stream-filter-field input{width:100%;min-width:0;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);padding:7px 11px;font:inherit;font-size:13px;outline:none}
    .stream-filter-field input:focus{border-color:var(--ink)}
    #streamDouble{min-width:42px;height:32px;border:1px solid var(--ink);border-radius:999px;background:#fff;color:var(--ink);font-weight:700;cursor:pointer}
    #streamDouble:hover:not(:disabled){background:var(--ink);color:#fff}
    #streamDouble:disabled{opacity:.35;cursor:default}
    @media(max-width:560px){.stream-filter-bar{align-items:end}.stream-filter-field input{font-size:16px}}
  `;
  document.head.appendChild(style);

  ensureControls();
})();