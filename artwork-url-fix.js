(() => {
  const nativeFetch = window.fetch.bind(window);
  const BBC_ARTWORK_HTTP = 'http://ichef.bbci.co.uk/';
  const BBC_ARTWORK_HTTPS = 'https://ichef.bbci.co.uk/';
  const NPR_ARTWORK_HTTP = 'url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com';
  const NPR_ARTWORK_HTTPS = 'url=https%3A%2F%2Fnpr-brightspot.s3.amazonaws.com';
  const ARTWORK_MAP = new Map([
    ['https://ichef.bbci.co.uk/images/ic/3000x3000/p0lqf7hf.jpg', 'https://files.tangkk-x2o.com/web-podcasts/artwork/bbc/p0lqf7hf.jpg'],
    ['https://ichef.bbci.co.uk/images/ic/3000x3000/p0m1q0p7.jpg', 'https://files.tangkk-x2o.com/web-podcasts/artwork/bbc/p0m1q0p7.jpg'],
    ['https://ichef.bbci.co.uk/images/ic/3000x3000/p0nr577g.jpg', 'https://files.tangkk-x2o.com/web-podcasts/artwork/bbc/p0nr577g.jpg'],
    ['https://ichef.bbci.co.uk/images/ic/3000x3000/p0ncxykc.jpg', 'https://files.tangkk-x2o.com/web-podcasts/artwork/bbc/p0ncxykc.jpg'],
    ['https://ichef.bbci.co.uk/images/ic/3000x3000/p0kxnkls.jpg', 'https://files.tangkk-x2o.com/web-podcasts/artwork/bbc/p0kxnkls.jpg'],
    ['https://i1.sndcdn.com/avatars-000326154119-ogb1ma-original.jpg', 'https://files.tangkk-x2o.com/web-podcasts/artwork/soundcloud/daodu-tech.jpg'],
    ['https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/43131353/5bf8fedc5204badc.jpg', 'https://files.tangkk-x2o.com/web-podcasts/artwork/cloudfront/fall-civilizations.jpg']
  ]);

  function shouldRewrite(url) {
    try {
      const parsed = new URL(url, location.href);
      return parsed.origin === location.origin && (parsed.pathname.endsWith('/episodes.json') || parsed.pathname.includes('/shows/'));
    } catch {
      return false;
    }
  }

  window.fetch = async function artworkSafeFetch(input, init) {
    const response = await nativeFetch(input, init);
    const rawUrl = typeof input === 'string' || input instanceof URL ? input : input?.url;
    if (!response.ok || !shouldRewrite(rawUrl)) return response;

    const text = await response.clone().text();
    let rewritten = text
      .replaceAll(BBC_ARTWORK_HTTP, BBC_ARTWORK_HTTPS)
      .replaceAll(NPR_ARTWORK_HTTP, NPR_ARTWORK_HTTPS);

    ARTWORK_MAP.forEach((cached, original) => {
      rewritten = rewritten.replaceAll(original, cached);
    });

    if (rewritten === text) return response;

    return new Response(rewritten, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };
})();
