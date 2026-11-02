const url='https://castbox.fm/channel/%E9%BA%A5%E9%BA%A5%E5%BB%A3%E6%92%AD-id3052674?limit=607&skip=0';
const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
const html=await r.text();
console.log('STATUS',r.status,'FINAL',r.url,'LEN',html.length);
for(const re of [
 /https?:[^"'\\s<>]+anchor\.fm[^"'\\s<>]*/gi,
 /https?:[^"'\\s<>]+d3ctxlq1ktw2nl[^"'\\s<>]*/gi,
 /https?:[^"'\\s<>]+(?:\.mp3|\.m4a)[^"'\\s<>]*/gi,
 /https?:[^"'\\s<>]+castbox[^"'\\s<>]*(?:audio|episode)[^"'\\s<>]*/gi
]){
 const m=[...html.matchAll(re)].map(x=>x[0]);
 console.log('MATCH',re.toString(),'COUNT',m.length,'FIRST',JSON.stringify(m.slice(0,5)),'LAST',JSON.stringify(m.slice(-5)));
}
for(const key of ['2020-','2021-','Oct 4, 2020','episodeId','audioUrl','playUrl','mediaUrl','enclosure','id3052674','__NEXT_DATA__','__NUXT__']){
 const low=html.toLowerCase(), k=key.toLowerCase(); let p=0,n=0;
 while((p=low.indexOf(k,p))>=0&&n<8){console.log('\nKEY',key,'AT',p,'\n'+html.slice(Math.max(0,p-1000),Math.min(html.length,p+2200)).replace(/\s+/g,' '));p+=k.length;n++;}
}
