import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const basePodcasts = JSON.parse(await fs.readFile(path.join(root, 'podcasts.json'), 'utf8'));
const addedPodcasts = await fs.readFile(path.join(root, 'podcasts-additions.json'), 'utf8').then(JSON.parse).catch(() => []);
const podcasts = [...new Map([...basePodcasts, ...addedPodcasts].map(podcast => [podcast.id, podcast])).values()];
const previous = await fs.readFile(path.join(root, 'episodes.json'), 'utf8').then(JSON.parse).catch(() => ({shows: []}));
const previousById = new Map(previous.shows?.map(show => [show.id, show]) || []);
const showsDir = path.join(root, 'shows');
await fs.mkdir(showsDir, {recursive: true});
const previousDetails = new Map(await Promise.all(podcasts.map(async podcast => {
  const detail = await fs.readFile(path.join(showsDir, `${podcast.id}.json`), 'utf8').then(JSON.parse).catch(() => null);
  return [podcast.id, detail];
})));

const decode = value => (value || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replaceAll('&amp;', '&').replaceAll('&#38;', '&').replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'").replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const clean = value => decode(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (xml, names) => {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) return clean(match[1]);
  }
  return '';
};
const attr = (xml, expression, name) => decode(xml.match(new RegExp(`${expression}[^>]*\\b${name}=["']([^"']+)`, 'i'))?.[1]);
const normalizeArtwork = value => (value || '')
  .replace(/^http:\/\/ichef\.bbci\.co\.uk/i, 'https://ichef.bbci.co.uk')
  .replace('url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com', 'url=https%3A%2F%2Fnpr-brightspot.s3.amazonaws.com');
const fetchText = async (url, userAgent = 'WebPodcasts/1.0') => {
  const response = await fetch(url, {redirect: 'follow', signal: AbortSignal.timeout(25000), headers: {'user-agent': userAgent}});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};
const fetchJson = async (url, userAgent = 'WebPodcasts/1.0') => JSON.parse(await fetchText(url, userAgent));

function mergeEpisodes(...episodeLists) {
  const merged = new Map();
  for (const episode of episodeLists.flat().filter(Boolean)) {
    const key = episode.id || episode.audio || episode.link;
    if (!key) continue;
    merged.set(key, {...(merged.get(key) || {}), ...episode});
  }
  return [...merged.values()]
    .filter(episode => episode.audio)
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, 1000);
}

function normalizeJsonEpisode(episode, podcast, index, fallbackLink = '') {
  const attachment = episode?.attachments?.find(item => item?.url) || episode?.attachment || null;
  const audio = episode?.enclosure?.url || episode?.media?.source?.url || episode?.media?.url || episode?.audio || episode?.audioUrl || episode?.audio_url || attachment?.url || '';
  if (!audio) return null;
  const dateText = episode?.pubDate || episode?.pub_date || episode?.publishedAt || episode?.published_at || episode?.date_published || '';
  const id = episode?.eid || episode?.id || episode?.guid || episode?.url || `${podcast.id}-${index}-${dateText}`;
  return {
    id: String(id),
    title: episode?.title || '未命名單集',
    description: clean(episode?.shownotes || episode?.description || episode?.content_html || episode?.content_text || episode?.summary || '').slice(0, 420),
    publishedAt: Number.isNaN(Date.parse(dateText)) ? null : new Date(dateText).toISOString(),
    duration: episode?.duration != null ? String(episode.duration) : episode?.duration_in_seconds != null ? String(episode.duration_in_seconds) : attachment?.duration_in_seconds != null ? String(attachment.duration_in_seconds) : '',
    audio,
    link: episode?.link || episode?.url || fallbackLink
  };
}

async function fetchXiaoyuzhouWebHistory(podcast, pid) {
  const cachedCount = previousDetails.get(podcast.id)?.episodes?.length || 0;
  if (cachedCount > 20) return [];
  const items = [];
  const seen = new Set();
  for (let page = 1; page <= 60; page += 1) {
    const url = `https://www.xiaoyuzhoufm.com/api/web/episodes?podcast_id=${encodeURIComponent(pid)}&page=${page}`;
    let payload;
    try {
      payload = await fetchJson(url, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150 Safari/537.36');
    } catch (error) {
      if (page === 1) console.log(`Xiaoyuzhou public history unavailable for ${podcast.id}: ${error.message}`);
      break;
    }
    const rows = payload?.data?.episodes || payload?.episodes || payload?.data?.data?.episodes || [];
    if (!Array.isArray(rows) || !rows.length) break;
    let added = 0;
    rows.forEach((episode, index) => {
      const normalized = normalizeJsonEpisode(episode, podcast, items.length + index, `https://www.xiaoyuzhoufm.com/podcast/${pid}`);
      if (!normalized || seen.has(normalized.id)) return;
      seen.add(normalized.id);
      items.push(normalized);
      added += 1;
    });
    if (!added || rows.length < 15) break;
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  if (items.length) console.log(`Xiaoyuzhou public history ${podcast.id}: ${items.length} episodes`);
  return items;
}

async function fetchTyplogHistory(podcast) {
  let origin;
  try {
    origin = new URL(podcast.feed).origin;
  } catch {
    return [];
  }
  if (!origin.endsWith('.typlog.io')) return [];
  const items = [];
  const currentYear = new Date().getUTCFullYear();
  let consecutiveEmptyYears = 0;
  for (let year = currentYear; year >= 2015; year -= 1) {
    try {
      const payload = await fetchJson(`${origin}/api/episodes/year/${year}`);
      const rows = Array.isArray(payload) ? payload : payload?.items || payload?.episodes || payload?.data || [];
      if (!Array.isArray(rows) || !rows.length) {
        consecutiveEmptyYears += 1;
        if (items.length && consecutiveEmptyYears >= 2) break;
        continue;
      }
      consecutiveEmptyYears = 0;
      rows.forEach((episode, index) => {
        const normalized = normalizeJsonEpisode(episode, podcast, items.length + index, origin);
        if (normalized) items.push(normalized);
      });
    } catch (error) {
      if (year === currentYear) console.log(`Typlog history API unavailable for ${podcast.id}: ${error.message}`);
      break;
    }
  }
  if (items.length) console.log(`Typlog history ${podcast.id}: ${items.length} episodes`);
  return items;
}

async function updateXiaoyuzhou(podcast) {
  const pid = podcast.feed.slice('xiaoyuzhou:'.length);
  const link = `https://www.xiaoyuzhoufm.com/podcast/${pid}`;
  const html = await fetchText(link, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150 Safari/537.36');
  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!nextData) throw new Error('Missing Xiaoyuzhou page data');
  const pageData = JSON.parse(nextData);
  const source = pageData?.props?.pageProps?.podcast;
  if (!source) throw new Error('Missing Xiaoyuzhou podcast data');

  const latest = (source.episodes || []).map((episode, index) => normalizeJsonEpisode(episode, podcast, index, link)).filter(Boolean);
  if (!latest.length) throw new Error('No playable Xiaoyuzhou episodes');
  const publicHistory = await fetchXiaoyuzhouWebHistory(podcast, pid);
  const cached = previousDetails.get(podcast.id)?.episodes || [];
  const items = mergeEpisodes(cached, publicHistory, latest);

  const artwork = normalizeArtwork(
    podcast.artwork ||
    source.image?.largePicUrl ||
    source.image?.middlePicUrl ||
    source.image?.smallPicUrl ||
    ''
  );
  return {
    ...podcast,
    feed: link,
    artwork,
    description: clean(source.description || ''),
    episodes: items,
    status: 'ok',
    checkedAt: new Date().toISOString()
  };
}

async function update(podcast) {
  try {
    if (podcast.feed.startsWith('xiaoyuzhou:')) return await updateXiaoyuzhou(podcast);

    const xml = await fetchText(podcast.feed);
    const channel = xml.match(/<channel\b[\s\S]*?<item\b/i)?.[0] || xml;
    const artwork = normalizeArtwork(podcast.artwork || attr(channel, '<itunes:image', 'href') || attr(channel, '<image', 'href') || tag(channel, ['url']));
    const description = tag(channel, ['description', 'itunes:summary', 'subtitle']);
    const latest = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].slice(0, 1000).map((match, index) => {
      const item = match[0];
      const rawAudio = attr(item, '<enclosure', 'url') || attr(item, '<media:content', 'url');
      const audio = rawAudio
        .replace(/^http:\/\/open\.live\.bbc\.co\.uk/i, 'https://open.live.bbc.co.uk')
        .replace(/^http:\/\/cdn5\.vistopia\.com\.cn/i, 'https://cdn5.vistopia.com.cn');
      if (!audio) return null;
      const dateText = tag(item, ['pubDate', 'dc:date', 'published']);
      const duration = tag(item, ['itunes:duration']);
      return {
        id: tag(item, ['guid']) || `${podcast.id}-${index}-${dateText}`,
        title: tag(item, ['title']) || '未命名單集',
        description: tag(item, ['description', 'content:encoded', 'itunes:summary']).slice(0, 420),
        publishedAt: Number.isNaN(Date.parse(dateText)) ? null : new Date(dateText).toISOString(),
        duration,
        audio,
        link: tag(item, ['link'])
      };
    }).filter(Boolean);
    if (!latest.length) throw new Error('No playable episodes');
    const typlogHistory = await fetchTyplogHistory(podcast);
    const cached = previousDetails.get(podcast.id)?.episodes || [];
    const items = mergeEpisodes(cached, typlogHistory, latest);
    return {...podcast, artwork, description, episodes: items, status: 'ok', checkedAt: new Date().toISOString()};
  } catch (error) {
    const cached = previousDetails.get(podcast.id) || previousById.get(podcast.id);
    if (cached?.episodes?.length) return {...cached, status: 'cached', error: error.message, checkedAt: new Date().toISOString()};
    return {...podcast, artwork: '', description: '', episodes: [], status: 'error', error: error.message, checkedAt: new Date().toISOString()};
  }
}

const shows = [];
for (let index = 0; index < podcasts.length; index += 6) {
  const batch = await Promise.all(podcasts.slice(index, index + 6).map(update));
  shows.push(...batch);
  console.log(`Updated ${Math.min(index + 6, podcasts.length)}/${podcasts.length}`);
}

await Promise.all(shows.map(show => fs.writeFile(
  path.join(showsDir, `${show.id}.json`),
  `${JSON.stringify(show, null, 2)}\n`
)));

const shortHistories = shows.filter(show => show.episodes.length > 0 && show.episodes.length <= 20);
if (shortHistories.length) {
  console.log(`Short histories (<=20): ${shortHistories.map(show => `${show.id}:${show.episodes.length}`).join(', ')}`);
}

const totalEpisodeCount = shows.reduce((sum, show) => sum + show.episodes.length, 0);
const summaryShows = shows.map(show => ({...show, episodes: show.episodes.slice(0, 3)}));
const payload = {
  generatedAt: new Date().toISOString(),
  showCount: summaryShows.length,
  episodeCount: totalEpisodeCount,
  shows: summaryShows
};
await fs.writeFile(path.join(root, 'episodes.json'), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${payload.showCount} shows and ${payload.episodeCount} historical episodes`);
