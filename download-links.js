(() => {
  const originalEpisodeCard = episodeCard;

  const safeFilename = value => String(value || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  const extensionFor = (url, type) => {
    const mime = String(type || '').toLowerCase();
    if (mime.includes('mp4') || mime.includes('m4a')) return '.m4a';
    if (mime.includes('mpeg')) return '.mp3';
    if (mime.includes('aac')) return '.aac';
    if (mime.includes('ogg')) return '.ogg';
    const match = String(url || '').match(/\.(mp3|m4a|aac|ogg|wav)(?:[?#]|$)/i);
    return match ? `.${match[1].toLowerCase()}` : '.mp3';
  };

  episodeCard = function episodeCardWithDownload(show, episode) {
    const html = originalEpisodeCard(show, episode);
    if (!episode?.audio) return html;

    const filename = safeFilename(`${show?.name || 'podcast'} - ${episode?.title || 'episode'}`);
    const downloadLink = `<button class="download-card" type="button" data-download-url="${escapeHtml(episode.audio)}" data-download-name="${escapeHtml(filename)}" aria-label="下載 ${escapeHtml(episode.title)}" title="下載原始音訊">↓</button>`;
    return html.replace('<button class="favorite', `${downloadLink}<button class="favorite`);
  };

  async function downloadAudio(button) {
    const url = button.dataset.downloadUrl;
    const baseName = button.dataset.downloadName || 'podcast-episode';
    if (!url || button.dataset.downloading === '1') return;

    button.dataset.downloading = '1';
    const originalText = button.textContent;
    button.textContent = '…';
    button.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (!blob.size) throw new Error('Empty audio');

      const filename = `${baseName}${extensionFor(url, blob.type)}`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      log?.('Download fallback', { message: error.message, url });
      const opened = window.open(url, '_blank', 'noopener');
      if (!opened) location.href = url;
    } finally {
      button.dataset.downloading = '0';
      button.removeAttribute('aria-busy');
      button.textContent = originalText;
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.download-card');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    downloadAudio(button);
  });

  const style = document.createElement('style');
  style.textContent = `
    .download-card {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 50%;
      background: #fff;
      color: var(--muted);
      font-size: 17px;
      line-height: 1;
      cursor: pointer;
    }
    .download-card:hover {
      border-color: var(--line);
      background: var(--soft);
      color: var(--ink);
    }
    .download-card[aria-busy="true"] {
      cursor: progress;
      opacity: .6;
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
