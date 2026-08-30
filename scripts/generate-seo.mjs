import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const showsRoot = path.join(root, 'shows');
const catalog = JSON.parse(await fs.readFile(path.join(root, 'episodes.json'), 'utf8'));
const lastmod = String(catalog.generatedAt || new Date().toISOString()).slice(0, 10);

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const cleanText = value => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const truncate = (value, length = 155) => {
  const text = cleanText(value);
  return text.length > length ? `${text.slice(0, length - 1).trim()}…` : text;
};

const jsonLd = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const validId = id => /^[a-z0-9-]+$/.test(id);

for (const entry of await fs.readdir(showsRoot, {withFileTypes: true})) {
  if (entry.isDirectory()) await fs.rm(path.join(showsRoot, entry.name), {recursive: true});
}

const details = [];
for (const summary of catalog.shows) {
  if (!validId(summary.id)) throw new Error(`Unsafe show id: ${summary.id}`);
  const detail = JSON.parse(await fs.readFile(path.join(showsRoot, `${summary.id}.json`), 'utf8'));
  details.push(detail);
}

const sharedStyle = `
  :root{color-scheme:light;--ink:#111;--muted:#686868;--line:#c9c9c7;--soft:#f4f4f1;--accent:#e4332a}*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:15px/1.55 system-ui,sans-serif}.page{width:min(1000px,calc(100% - 32px));margin:auto;padding:40px 0 80px}a{color:inherit}.back{display:inline-block;margin-bottom:22px;color:var(--accent)}header{display:grid;grid-template-columns:150px 1fr;gap:24px;border-bottom:2px solid var(--ink);padding-bottom:28px}header img{width:150px;height:150px;border-radius:14px;background:var(--soft);object-fit:cover}h1{margin:0;font-size:clamp(30px,6vw,52px);line-height:1.05;letter-spacing:-.045em}.meta{margin:8px 0;color:var(--accent);font-size:12px}.description{max-width:720px;color:#444}.episodes{margin-top:30px}.episodes h2{font-size:22px}.episodes ol{margin:0;padding:0;list-style:none}.episodes li{display:grid;grid-template-columns:110px 1fr;gap:20px;border-top:1px solid var(--line);padding:14px 0}.episodes time{color:var(--muted);font-size:12px}.episodes h3{margin:0;font-size:15px}.episodes p{margin:5px 0 0;color:var(--muted);font-size:12px}.directory{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:28px}.card{display:grid;grid-template-columns:64px 1fr;gap:12px;border:1px solid var(--line);border-radius:11px;padding:12px;text-decoration:none}.card:hover{border-color:var(--ink)}.card img{width:64px;height:64px;border-radius:8px;background:var(--soft);object-fit:cover}.card strong{display:block}.card span{display:block;margin-top:5px;color:var(--muted);font-size:11px}@media(max-width:680px){header{grid-template-columns:88px 1fr}header img{width:88px;height:88px}.directory{grid-template-columns:1fr}.episodes li{grid-template-columns:1fr;gap:4px}}
`;

const indexCards = details.map(show => `
    <a class="card" href="./${escapeHtml(show.id)}/">
      <img src="${escapeHtml(show.artwork)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <span><strong>${escapeHtml(show.name)}</strong><span>${escapeHtml(show.publisher)} · ${escapeHtml(show.language)} · ${escapeHtml(show.category)}</span></span>
    </a>`).join('');

const directorySchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Web Podcasts 節目目錄',
  numberOfItems: details.length,
  itemListElement: details.map((show, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: show.name,
    url: `https://tangkk.github.io/web-podcasts/shows/${show.id}/`
  }))
};

const indexHtml = `<!doctype html>
<html lang="zh-Hant"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>華語、粵語與英語播客節目目錄｜Web Podcasts</title>
  <meta name="description" content="瀏覽 Web Podcasts 精選的華語、粵語與英語播客節目，查看節目介紹與最新單集。">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="https://tangkk.github.io/web-podcasts/shows/">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <meta property="og:type" content="website"><meta property="og:site_name" content="Web Podcasts">
  <meta property="og:title" content="播客節目目錄｜Web Podcasts"><meta property="og:description" content="瀏覽精選華語、粵語與英語播客節目。">
  <meta property="og:url" content="https://tangkk.github.io/web-podcasts/shows/"><meta property="og:image" content="https://tangkk.github.io/web-podcasts/og-image.png">
  <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
  <script type="application/ld+json">${jsonLd(directorySchema)}</script><style>${sharedStyle}</style>
</head><body><main class="page">
  <a class="back" href="../">← 返回 Web Podcasts 播放器</a>
  <h1>播客節目目錄</h1><p class="description">瀏覽本站精選的華語、粵語與英語播客，查看節目介紹與最新單集。</p>
  <div class="directory">${indexCards}</div>
</main></body></html>
`;

await fs.writeFile(path.join(showsRoot, 'index.html'), indexHtml);

for (const show of details) {
  const pageDir = path.join(showsRoot, show.id);
  await fs.mkdir(pageDir, {recursive: true});
  const canonical = `https://tangkk.github.io/web-podcasts/shows/${show.id}/`;
  const appUrl = `../../#show=${encodeURIComponent(show.id)}`;
  const description = truncate(show.description || `${show.name} 是 Web Podcasts 收錄的播客節目。`);
  const episodes = (show.episodes || []).slice(0, 20);
  const latestDate = episodes.find(episode => episode.publishedAt)?.publishedAt;
  const episodeRows = episodes.map(episode => {
    const date = episode.publishedAt ? episode.publishedAt.slice(0, 10) : '';
    const href = /^https?:\/\//.test(episode.link || '') ? episode.link : appUrl;
    return `<li><time datetime="${escapeHtml(episode.publishedAt || '')}">${escapeHtml(date || episode.duration || '單集')}</time><div><h3><a href="${escapeHtml(href)}" rel="external noreferrer">${escapeHtml(episode.title)}</a></h3><p>${escapeHtml(truncate(episode.description, 180))}</p></div></li>`;
  }).join('');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    name: show.name,
    description,
    url: canonical,
    image: show.artwork || 'https://tangkk.github.io/web-podcasts/og-image.png',
    inLanguage: show.language,
    publisher: {'@type': 'Organization', name: show.publisher || show.name},
    ...(show.feed?.startsWith('http') ? {webFeed: show.feed} : {}),
    episode: episodes.slice(0, 10).map(episode => ({
      '@type': 'PodcastEpisode',
      name: episode.title,
      ...(episode.publishedAt ? {datePublished: episode.publishedAt} : {}),
      ...(episode.link?.startsWith('http') ? {url: episode.link} : {})
    }))
  };
  const feedLink = show.feed?.startsWith('http') ? `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(show.name)} RSS" href="${escapeHtml(show.feed)}">` : '';
  const page = `<!doctype html>
<html lang="zh-Hant"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(show.name)}｜播客節目與最新單集｜Web Podcasts</title>
  <meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="${canonical}"><link rel="icon" href="../../favicon.svg" type="image/svg+xml">${feedLink}
  <meta property="og:type" content="website"><meta property="og:site_name" content="Web Podcasts"><meta property="og:title" content="${escapeHtml(show.name)}｜Web Podcasts">
  <meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="https://tangkk.github.io/web-podcasts/og-image.png">
  <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://tangkk.github.io/web-podcasts/og-image.png">
  <script type="application/ld+json">${jsonLd(schema)}</script><style>${sharedStyle}</style>
</head><body><main class="page">
  <a class="back" href="../">← 返回播客目錄</a>
  <header><img src="${escapeHtml(show.artwork)}" alt="${escapeHtml(show.name)} 節目封面" referrerpolicy="no-referrer"><div><h1>${escapeHtml(show.name)}</h1><p class="meta">${escapeHtml(show.publisher)} · ${escapeHtml(show.region)} · ${escapeHtml(show.language)} · ${escapeHtml(show.category)}</p><p class="description">${escapeHtml(cleanText(show.description))}</p><p><a href="${appUrl}">在 Web Podcasts 中打開節目</a></p></div></header>
  <section class="episodes"><h2>最新單集</h2><ol>${episodeRows}</ol></section>
</main></body></html>
`;
  await fs.writeFile(path.join(pageDir, 'index.html'), page);
  show.__lastmod = String(latestDate || show.checkedAt || catalog.generatedAt).slice(0, 10);
}

const sitemapUrls = [
  `  <url><loc>https://tangkk.github.io/web-podcasts/</loc><lastmod>${lastmod}</lastmod><priority>1.0</priority></url>`,
  `  <url><loc>https://tangkk.github.io/web-podcasts/shows/</loc><lastmod>${lastmod}</lastmod><priority>0.9</priority></url>`,
  ...details.map(show => `  <url><loc>https://tangkk.github.io/web-podcasts/shows/${show.id}/</loc><lastmod>${show.__lastmod}</lastmod><priority>0.7</priority></url>`)
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.join('\n')}\n</urlset>\n`;
await fs.writeFile(path.join(root, 'sitemap.xml'), sitemap);
console.log(`Generated ${details.length} show pages and sitemap.xml`);
