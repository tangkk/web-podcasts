const url='https://www.podcasts-online.org/es/mai-mai-guang-bo-1520392595';
const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
const html=await r.text();
const hrefs=[...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]);
console.log('SHOW_HREFS', [...new Set(hrefs.filter(x=>/mai-mai-guang-bo|1520392595|page|pagina/i.test(x)))]);
for (const key of ['itemLength','itemsUrl','page-links','loadMore','load_more','pagination','offset','ajax','next']) {
  let start=0,count=0;
  while ((start=html.toLowerCase().indexOf(key.toLowerCase(),start))>=0 && count<10) {
    console.log('\nKEY',key,'AT',start,'\n',html.slice(Math.max(0,start-700),Math.min(html.length,start+1200)).replace(/\s+/g,' '));
    start+=key.length; count++;
  }
}
