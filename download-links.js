(() => {
  const originalEpisodeCard = episodeCard;

  const safeFilename = value => String(value || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  episodeCard = function episodeCardWithDownload(show, episode) {
    const html = originalEpisodeCard(show, episode);
    if (!episode?.audio) return html;

    const filename = safeFilename(`${show?.name || 'podcast'} - ${episode?.title || 'episode'}`);
    const downloadLink = `<a class="download-card" href="${escapeHtml(episode.audio)}" download="${escapeHtml(filename)}" target="_blank" rel="noopener" aria-label="下載 ${escapeHtml(episode.title)}" title="下載原始音訊">↓</a>`;
    return html.replace('<button class="favorite', `${downloadLink}<button class="favorite`);
  };

  const style = document.createElement('style');
  style.textContent = `
    .download-card {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 1px solid transparent;
      border-radius: 50%;
      background: #fff;
      color: var(--muted);
      font-size: 17px;
      line-height: 1;
      text-decoration: none;
    }
    .download-card:hover {
      border-color: var(--line);
      background: var(--soft);
      color: var(--ink);
    }
    @media (max-width: 560px) {
      .download-card {
        width: 30px;
        height: 30px;
        font-size: 16px;
      }
    }
  `;
  document.head.appendChild(style);
})();
