const urls = [
  'https://www.podcasts-online.org/es/mai-mai-guang-bo-1520392595',
  'https://www.podcasts-online.org/es/mai-mai-guang-bo-1520392595?page=2',
  'https://www.radio-hk.com/podcasts/mai-mai-guang-bo',
  'https://www.radio-hk.com/podcasts/mai-mai-guang-bo?page=20',
  'https://www.podcastrepublic.net/podcast/1520392595'
];

for (const url of urls) {
  console.log('\n===== URL', url, '=====');
  try {
    const r = await fetch(url, {redirect: 'follow', headers: {'user-agent':'Mozilla/5.0'}});
    const text = await r.text();
    console.log('STATUS', r.status, 'FINAL', r.url, 'LEN', text.length);
    const patterns = [
      /https?:[^"'\\s<>]+(?:\.mp3|\.m4a)[^"'\\s<>]*/gi,
      /https?:[^"'\\s<>]+d3ctxlq1ktw2nl[^"'\\s<>]*/gi,
      /https?:[^"'\\s<>]+anchor\.fm[^"'\\s<>]*/gi,
      /https?:[^"'\\s<>]+podcasters\.spotify\.com[^"'\\s<>]*/gi,
      /(?:page|pagination)[^<>"']{0,120}/gi,
      /2021[^<>"']{0,160}/gi,
      /2020[^<>"']{0,160}/gi
    ];
    for (const p of patterns) {
      const matches = [...text.matchAll(p)].map(m => m[0]).slice(0, 40);
      if (matches.length) console.log('MATCHES', p.toString(), JSON.stringify(matches, null, 2));
    }
  } catch (e) {
    console.log('ERROR', e.message);
  }
}