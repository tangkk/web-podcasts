const urls=[
 'https://s3.castbox.fm/webstatic/js/page.ch.6b331ae1.js.map',
 'https://s3.castbox.fm/webstatic/js/page.castbox.main.8e6c8379.js.map'
];
for(const url of urls){
 const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
 const t=await r.text();
 console.log('\nMAP',url,'STATUS',r.status,'LEN',t.length,'HEAD',t.slice(0,100));
 if(!r.ok||!t.startsWith('{')) continue;
 const j=JSON.parse(t);
 console.log('SOURCES',j.sources?.length);
 for(let i=0;i<(j.sources||[]).length;i++){
  const name=j.sources[i]||'', src=j.sourcesContent?.[i]||'';
  if(/sign|signature|request|api|fetch|http/i.test(name) || /X-CastBox-UA|castboxHostName|no-cache|episode_list\/v2/.test(src)){
   console.log('\nSOURCE',i,name,'LEN',src.length);
   for(const key of ['X-CastBox-UA','castboxHostName','episode_list/v2','no-cache','signature','sign','md5']){
    const p=src.indexOf(key); if(p>=0) console.log('KEY',key,'AT',p,'\n'+src.slice(Math.max(0,p-1800),Math.min(src.length,p+4200)));
   }
  }
 }
}