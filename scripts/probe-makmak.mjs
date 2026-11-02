const url='https://castbox.fm/channel/%E9%BA%A5%E9%BA%A5%E5%BB%A3%E6%92%AD-id3052674?limit=700&skip=0';
const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
const html=await r.text();
console.log('STATUS',r.status,'LEN',html.length,'URL',r.url);
for (const key of ['2020','2021','audio','mp3','episode','feedUrl','playUrl','mediaUrl','enclosure','__NEXT_DATA__','__NUXT__']) {
 let pos=0,n=0;
 while((pos=html.toLowerCase().indexOf(key.toLowerCase(),pos))>=0 && n<12){
   console.log('\nKEY',key,'AT',pos,'\n',html.slice(Math.max(0,pos-1000),Math.min(html.length,pos+2200)).replace(/\s+/g,' '));
   pos+=key.length;n++;
 }
}
