(() => {
  const nativeFetch = window.fetch.bind(window);
  const BBC_ARTWORK_HTTP = 'http://ichef.bbci.co.uk/';
  const BBC_ARTWORK_HTTPS = 'https://ichef.bbci.co.uk/';
  const NPR_ARTWORK_HTTP = 'url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com';
  const NPR_ARTWORK_HTTPS = 'url=https%3A%2F%2Fnpr-brightspot.s3.amazonaws.com';
  const ARTWORK_ROOT = 'https://files.tangkk-x2o.com/public/web-podcasts/artwork/';
  const ARTWORK_MAP = new Map([
    ['https://ichef.bbci.co.uk/images/ic/3000x3000/p0lqf7hf.jpg', `${ARTWORK_ROOT}bbc/p0lqf7hf.jpg`],
    ['https://ichef.bbci.co.uk/images/ic/3000x3000/p0m1q0p7.jpg', `${ARTWORK_ROOT}bbc/p0m1q0p7.jpg`],
    ['https://ichef.bbci.co.uk/images/ic/3000x3000/p0nr577g.jpg', `${ARTWORK_ROOT}bbc/p0nr577g.jpg`],
    ['https://ichef.bbci.co.uk/images/ic/3000x3000/p0ncxykc.jpg', `${ARTWORK_ROOT}bbc/p0ncxykc.jpg`],
    ['https://ichef.bbci.co.uk/images/ic/3000x3000/p0kxnkls.jpg', `${ARTWORK_ROOT}bbc/p0kxnkls.jpg`],
    ['https://i1.sndcdn.com/avatars-000326154119-ogb1ma-original.jpg', `${ARTWORK_ROOT}soundcloud/daodu-tech.jpg`],
    ['https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/43131353/5bf8fedc5204badc.jpg', `${ARTWORK_ROOT}cloudfront/fall-civilizations.jpg`],
    ['https://cdn.lizhi.fm/podcast_cover/2019/12/17/2777324026164844615.jpg', `${ARTWORK_ROOT}lizhi/dscience.jpg`],
    ['https://sbs-rss.streamguys1.com/sbs/20230405221522-SBS-Podcasts_SBSCantonese_3000x3000px.jpg', `${ARTWORK_ROOT}sbs/sbs-cantonese.jpg`]
  ]);

  // RSS artwork URLs can change independently for different shows from the same publisher.
  // These six show-to-file associations are verified against the historical catalog.
  const ARTWORK_BY_SHOW_ID = new Map([
    ['in-our-time', `${ARTWORK_ROOT}bbc/p0m1q0p7.jpg`],
    ['youre-dead-to-me', `${ARTWORK_ROOT}bbc/p0nr577g.jpg`],
    ['bbc-global-news', `${ARTWORK_ROOT}bbc/p0lqf7hf.jpg`],
    ['bbc-global-story', `${ARTWORK_ROOT}bbc/p0ncxykc.jpg`],
    ['bbc-documentary', `${ARTWORK_ROOT}bbc/p0kxnkls.jpg`],
    ['sbs-cantonese', `${ARTWORK_ROOT}sbs/sbs-cantonese.jpg`]
  ]);

  function shouldRewrite(url) {
    try {
      const parsed = new URL(url, location.href);
      return parsed.origin === location.origin && (parsed.pathname.endsWith('/episodes.json') || parsed.pathname.includes('/shows/'));
    } catch {
      return false;
    }
  }

  function pinShowArtwork(show) {
    if (!show || typeof show !== 'object') return false;
    const mirrored = ARTWORK_BY_SHOW_ID.get(show.id);
    if (!mirrored || show.artwork === mirrored) return false;
    show.artwork = mirrored;
    return true;
  }

  window.fetch = async function artworkSafeFetch(input, init) {
    const response = await nativeFetch(input, init);
    const rawUrl = typeof input === 'string' || input instanceof URL ? input : input?.url;
    if (!response.ok || !shouldRewrite(rawUrl)) return response;

    const text = await response.clone().text();
    let rewritten = text
      .replaceAll(BBC_ARTWORK_HTTP, BBC_ARTWORK_HTTPS)
      .replaceAll(NPR_ARTWORK_HTTP, NPR_ARTWORK_HTTPS);

    ARTWORK_MAP.forEach((mirrored, original) => {
      rewritten = rewritten.replaceAll(original, mirrored);
    });

    try {
      const payload = JSON.parse(rewritten);
      let changed = false;
      if (Array.isArray(payload.shows)) {
        payload.shows.forEach(show => { changed = pinShowArtwork(show) || changed; });
      } else {
        changed = pinShowArtwork(payload);
      }
      if (changed) rewritten = JSON.stringify(payload);
    } catch {
      // Preserve the legacy URL replacements if the response is not catalog JSON.
    }

    if (rewritten === text) return response;

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('etag');
    return new Response(rewritten, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };
})();
