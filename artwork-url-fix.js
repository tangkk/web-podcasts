(() => {
  const nativeFetch = window.fetch.bind(window);
  const BBC_ARTWORK_HTTP = 'http://ichef.bbci.co.uk/';
  const BBC_ARTWORK_HTTPS = 'https://ichef.bbci.co.uk/';
  const NPR_ARTWORK_HTTP = 'url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com';
  const NPR_ARTWORK_HTTPS = 'url=https%3A%2F%2Fnpr-brightspot.s3.amazonaws.com';

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
    if (!text.includes(BBC_ARTWORK_HTTP) && !text.includes(NPR_ARTWORK_HTTP)) return response;

    return new Response(
      text
        .replaceAll(BBC_ARTWORK_HTTP, BBC_ARTWORK_HTTPS)
        .replaceAll(NPR_ARTWORK_HTTP, NPR_ARTWORK_HTTPS),
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      }
    );
  };
})();
