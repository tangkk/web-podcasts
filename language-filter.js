(() => {
  function languageMatches(showLanguage, selected) {
    if (selected === '全部') return true;
    const language = String(showLanguage || '');
    if (selected === 'English') return language.includes('English');
    return language.includes(selected);
  }

  renderFilters = function renderFiltersWithCantonese() {
    makeFilters(els.languageFilters, ['全部', '華語', '粵語', 'English'], state.language, value => {
      state.language = value;
      render();
    });
    makeFilters(els.categoryFilters, ['全部', '新聞時事', '商業科技', '社會文化', '歷史知識', '科學健康', '故事娛樂'], state.category, value => {
      state.category = value;
      render();
    });
  };

  filteredShows = function filteredShowsWithCantonese() {
    const query = normalize(state.query);
    return state.shows.filter(show => {
      const languageMatch = languageMatches(show.language, state.language);
      const categoryMatch = state.category === '全部' || show.category === state.category;
      const favoriteMatch = !state.favoritesOnly || state.favorites.has(show.id);
      const haystack = normalize([show.name, show.publisher, show.region, show.description, ...show.episodes.map(episode => episode.title)].join(' '));
      return languageMatch && categoryMatch && favoriteMatch && (!query || haystack.includes(query));
    });
  };

  renderFilters();
})();
