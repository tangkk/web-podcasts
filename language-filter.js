(() => {
  const regionFilters = document.createElement('div');
  regionFilters.id = 'regionFilters';
  regionFilters.className = 'filters region-filters';
  regionFilters.setAttribute('role', 'group');
  regionFilters.setAttribute('aria-label', '按地區篩選');
  els.languageFilters.parentNode.insertBefore(regionFilters, els.languageFilters);

  const style = document.createElement('style');
  style.textContent = `
    .region-filters { flex-basis: 100%; border-top: 1px solid #e6e6e6; padding-top: 11px; }
    .region-filters::before { content: "地區"; align-self: center; width: 44px; color: #888; font-size: 9px; font-weight: 750; letter-spacing: .08em; }
  `;
  document.head.appendChild(style);

  state.region = state.region || '全部';

  function languageMatches(showLanguage, selected) {
    if (selected === '全部') return true;
    const language = String(showLanguage || '');
    if (selected === 'English') return language.includes('English');
    return language.includes(selected);
  }

  function regionMatches(showRegion, selected) {
    if (selected === '全部') return true;
    return String(showRegion || '').split('・').map(value => value.trim()).includes(selected);
  }

  function availableRegions() {
    const preferredOrder = ['中國大陸', '香港', '台灣', '海外華語', '美國', '英國', '澳大利亞', '加拿大', '新加坡', '馬來西亞'];
    const regions = new Set();
    state.shows.forEach(show => {
      String(show.region || '').split('・').map(value => value.trim()).filter(Boolean).forEach(value => regions.add(value));
    });
    const ordered = preferredOrder.filter(region => regions.delete(region));
    return ['全部', ...ordered, ...[...regions].sort((a, b) => a.localeCompare(b, 'zh-Hant'))];
  }

  renderFilters = function renderFiltersWithRegionAndCantonese() {
    makeFilters(regionFilters, availableRegions(), state.region, value => {
      state.region = value;
      render();
    });
    makeFilters(els.languageFilters, ['全部', '華語', '粵語', 'English'], state.language, value => {
      state.language = value;
      render();
    });
    makeFilters(els.categoryFilters, ['全部', '新聞時事', '商業科技', '社會文化', '歷史知識', '科學健康', '故事娛樂'], state.category, value => {
      state.category = value;
      render();
    });
  };

  filteredShows = function filteredShowsWithRegionAndCantonese() {
    const query = normalize(state.query);
    return state.shows.filter(show => {
      const regionMatch = regionMatches(show.region, state.region);
      const languageMatch = languageMatches(show.language, state.language);
      const categoryMatch = state.category === '全部' || show.category === state.category;
      const favoriteMatch = !state.favoritesOnly || state.favorites.has(show.id);
      const haystack = normalize([show.name, show.publisher, show.region, show.description, ...show.episodes.map(episode => episode.title)].join(' '));
      return regionMatch && languageMatch && categoryMatch && favoriteMatch && (!query || haystack.includes(query));
    });
  };

  renderFilters();
})();
