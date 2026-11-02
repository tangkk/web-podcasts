const url='https://www.podcastrepublic.net/podcast/1520392595';
const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
const html=await r.text();
console.log('STATUS',r.status,'LEN',html.length);
for (const re of [
  /https?:[^"'\\s<>]+d3ctxlq1ktw2nl[^"'\\s<>]*/gi,
  /https?:[^"'\\s<>]+anchor\.fm\/s\/284eb8f8\/podcast\/play\/[^"'\\s<>]*/gi,
  /https?:[^"'\\s<>]+(?:\.mp3|\.m4a)[^"'\\s<>]*/gi
]) {
  const m=[...html.matchAll(re)].map(x=>x[0]);
  console.log('MATCH',re.toString(),'COUNT',m.length,'FIRST',JSON.stringify(m.slice(0,5)),'LAST',JSON.stringify(m.slice(-5)));
}
for (const key of ['2020','2021','__NEXT_DATA__','api/','fetch(','offset','page','episodeList','episodes','audioUrl','mediaUrl']) {
  const low=html.toLowerCase(), needle=key.toLowerCase();
  let pos=0,count=0;
  while((pos=low.indexOf(needle,pos))>=0 && count<6){
    console.log('\nKEY',key,'AT',pos,'\n'+html.slice(Math.max(0,pos-900),Math.min(html.length,pos+1800)).replace(/\s+/g,' '));
    pos+=needle.length;count++;
  }
}
const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>m[1]);
console.log('SCRIPTS',JSON.stringify([...new Set(scripts)],null,2));
