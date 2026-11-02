const url='https://www.podcasts-online.org/es/mai-mai-guang-bo-1520392595';
const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
const html=await r.text();
const needles=[...html.matchAll(/d3ctxlq1ktw2nl\.cloudfront\.net/gi)].map(m=>m.index);
console.log('STATUS',r.status,'LEN',html.length,'AUDIO_OCCURRENCES',needles.length);
for (const idx of [needles[0],needles[Math.floor(needles.length/2)],needles.at(-1)]) {
  if (idx==null) continue;
  console.log('\n--- SNIPPET ---\n'+html.slice(Math.max(0,idx-1800),Math.min(html.length,idx+1800)).replace(/\s+/g,' '));
}
const yearHits=[...html.matchAll(/(?:2020|2021)[^<]{0,80}/g)].map(m=>({i:m.index,s:m[0]}));
console.log('YEAR_HITS',yearHits.slice(0,30));
