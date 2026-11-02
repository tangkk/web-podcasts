const page='https://www.podcasts-online.org/es/mai-mai-guang-bo-1520392595';
const r=await fetch(page,{headers:{'user-agent':'Mozilla/5.0'}});
const html=await r.text();
const srcs=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>m[1]);
console.log('SCRIPTS',srcs);
for (const src0 of srcs) {
  try {
    const src=new URL(src0,page).href;
    const rr=await fetch(src,{headers:{'user-agent':'Mozilla/5.0'}});
    const js=await rr.text();
    console.log('\n===',src,'STATUS',rr.status,'LEN',js.length,'===');
    for (const key of ['fetch(','XMLHttpRequest','ajax','itemLength','itemsUrl','podcast','episode','offset','page','loadMore','load_more']) {
      let pos=0, n=0;
      while ((pos=js.toLowerCase().indexOf(key.toLowerCase(),pos))>=0 && n<8) {
        console.log('KEY',key,'AT',pos,js.slice(Math.max(0,pos-500),Math.min(js.length,pos+1000)).replace(/\s+/g,' '));
        pos+=key.length; n++;
      }
    }
  } catch(e) { console.log('ERR',src0,e.message); }
}
