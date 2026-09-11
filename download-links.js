(() => {
  const originalEpisodeCard = episodeCard;

  episodeCard = function episodeCardWithCopy(show, episode) {
    const html = originalEpisodeCard(show, episode);
    if (!episode?.audio) return html;

    const copyButton = `<button class="download-card" type="button" data-copy-audio-url="${escapeHtml(episode.audio)}" aria-label="复制 ${escapeHtml(episode.title)} 的音频链接" title="复制原始音频链接">⧉</button>`;
    return html.replace('<button class="favorite', `${copyButton}<button class="favorite`);
  };

  async function writeClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    if (!ok) throw new Error('copy unavailable');
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.download-card[data-copy-audio-url]');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();

    const url = button.dataset.copyAudioUrl;
    if (!url) return;

    const original = button.textContent;
    button.disabled = true;
    button.textContent = '…';

    writeClipboard(url).then(() => {
      button.textContent = '✓';
    }).catch(error => {
      console.warn('Episode audio link copy failed', error);
      button.textContent = '!';
    }).finally(() => {
      setTimeout(() => {
        if (!button.isConnected) return;
        button.disabled = false;
        button.textContent = original;
      }, 1200);
    });
  }, true);

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
      flex: 0 0 auto;
    }
    .download-card:hover {
      border-color: var(--line);
      background: var(--soft);
      color: var(--ink);
    }
    .download-card:disabled {
      opacity: .6;
      cursor: default;
    }
    @media (max-width: 560px) {
      .download-card {
        display: grid !important;
        width: 30px;
        height: 30px;
        min-width: 30px;
        font-size: 16px;
      }
    }
  `;
  document.head.appendChild(style);
})();
