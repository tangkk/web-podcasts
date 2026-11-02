const page='https://castbox.fm/channel/%E9%BA%A5%E9%BA%A5%E5%BB%A3%E6%92%AD-id3052674?limit=700&skip=0';
const r=await fetch(page,{headers:{'user-agent':'Mozilla/5.0'}});
const html=await r.text();
const srcs=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>new URL(m[1],page).href);
console.log('SCRIPTS',srcs);
for (const src of srcs) {
  try {
    const rr=await fetch(src,{headers:{'user-agent':'Mozilla/5.0'}});
    const js=await rr.text();
    console.log('\n===',src,'LEN',js.length,'===');
    const needles=['/api/','skip','limit','channel','episode','episodes','getChannel','episode_list','channelInfo'];
    for (const key of needles) {
      let pos=0,n=0;
      while((pos=js.indexOf(key,pos))>=0 && n<20){
        console.log('KEY',key,'AT',pos,js.slice(Math.max(0,pos-700),Math.min(js.length,pos+1300)).replace(/\s+/g,' '));
        pos+=key.length;n++;
      }
    }
  } catch(e){console.log('ERR',src,e.message)}
}
