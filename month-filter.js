(() => {
  let activeShowId = null;
  let selectedYear = '';
  let selectedMonth = '';

  const monthLabel = month => `${Number(month)}月`;
  const validDate = value => value && !Number.isNaN(new Date(value).getTime());
  const dateParts = value => {
    const date = new Date(value);
    return { year: String(date.getFullYear()), month: String(date.getMonth() + 1).padStart(2, '0') };
  };

  function yearsFor(show) {
    return [...new Set(show.episodes.filter(episode => validDate(episode.publishedAt)).map(episode => dateParts(episode.publishedAt).year))]
      .sort((a, b) => Number(b) - Number(a));
  }

  function monthsFor(show, year) {
    if (!year) return [];
    return [...new Set(show.episodes
      .filter(episode => validDate(episode.publishedAt) && dateParts(episode.publishedAt).year === year)
      .map(episode => dateParts(episode.publishedAt).month))]
      .sort((a, b) => Number(b) - Number(a));
  }

  function filteredEpisodes(show) {
    if (!selectedYear || !selectedMonth) return null;
    return show.episodes.filter(episode => {
      if (!validDate(episode.publishedAt)) return false;
      const parts = dateParts(episode.publishedAt);
      return parts.year === selectedYear && parts.month === selectedMonth;
    });
  }

  function filterMarkup(show) {
    const years = yearsFor(show);
    const months = monthsFor(show, selectedYear);
    return `<div class="detail-date-filter" aria-label="按年月篩選歷史單集">
      <span class="detail-date-filter-label">年月</span>
      <select id="detailYear" aria-label="年份">
        <option value="">全部年份</option>
        ${years.map(year => `<option value="${year}"${year === selectedYear ? ' selected' : ''}>${year}年</option>`).join('')}
      </select>
      <select id="detailMonth" aria-label="月份"${selectedYear ? '' : ' disabled'}>
        <option value="">全部月份</option>
        ${months.map(month => `<option value="${month}"${month === selectedMonth ? ' selected' : ''}>${monthLabel(month)}</option>`).join('')}
      </select>
      ${(selectedYear || selectedMonth) ? '<button id="clearDetailDate" class="detail-date-clear" type="button">清除</button>' : ''}
    </div>`;
  }

  renderDetail = function renderDetailWithMonthFilter() {
    const show = state.detailShow;
    if (activeShowId !== show.id) {
      activeShowId = show.id;
      selectedYear = '';
      selectedMonth = '';
    }

    const matched = filteredEpisodes(show);
    const filtering = Array.isArray(matched);
    const episodes = filtering ? matched : show.episodes.slice(0, state.detailVisible);

    document.body.classList.add('detail-open');
    els.resultCount.textContent = filtering
      ? `${selectedYear}年${Number(selectedMonth)}月 · ${episodes.length} 個單集`
      : `${show.episodes.length} 個可用歷史單集`;

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
      ${filterMarkup(show)}
      <div class="detail-list">${episodes.length ? episodes.map(episode => episodeCard(show, episode)).join('') : '<div class="empty">這個月份沒有單集。</div>'}</div>
      ${!filtering && episodes.length < show.episodes.length ? `<button id="loadMore" class="load-more" type="button">載入更多（${show.episodes.length - episodes.length}）</button>` : ''}
    </section>`;

    document.querySelector('#backToDirectory').addEventListener('click', closeShow);
    document.querySelector('.detail-favorite').addEventListener('click', () => toggleFavorite(show.id));
    document.querySelector('#loadMore')?.addEventListener('click', () => { state.detailVisible += 20; renderDetail(); });

    document.querySelector('#detailYear')?.addEventListener('change', event => {
      selectedYear = event.target.value;
      selectedMonth = '';
      renderDetail();
    });
    document.querySelector('#detailMonth')?.addEventListener('change', event => {
      selectedMonth = event.target.value;
      renderDetail();
    });
    document.querySelector('#clearDetailDate')?.addEventListener('click', () => {
      selectedYear = '';
      selectedMonth = '';
      state.detailVisible = 20;
      renderDetail();
    });

    bindCards();
  };

  const style = document.createElement('style');
  style.textContent = `
    .detail-date-filter {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin: 0 0 14px;
      border-bottom: 1px solid var(--line);
      padding: 0 0 12px;
    }
    .detail-date-filter-label {
      color: var(--muted);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: .08em;
    }
    .detail-date-filter select {
      min-width: 104px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 7px 28px 7px 9px;
      background: #fff;
      color: var(--ink);
      font-size: 12px;
    }
    .detail-date-filter select:disabled { color: #aaa; background: var(--soft); }
    .detail-date-clear {
      border: 0;
      padding: 6px 8px;
      background: transparent;
      color: var(--muted);
      font-size: 11px;
      cursor: pointer;
    }
    .detail-date-clear:hover { color: var(--ink); }
    .detail-list > .empty { grid-column: 1 / -1; }
  `;
  document.head.appendChild(style);
})();
