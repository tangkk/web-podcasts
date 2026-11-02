const hosts=['https://data.castbox.fm','https://castbox.fm/api/proxy/data'];
for(const host of hosts){
 for(const skip of [450,500,550]){
  const url=host+'/data/episode_list/v2?cid=3052674&skip='+skip+'&limit=60&web=1';
  try{
   const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0','accept':'application/json'}});
   const t=await r.text();
   console.log('\nURL',url,'STATUS',r.status,'LEN',t.length,'CT',r.headers.get('content-type'));
   if(!r.ok){console.log(t.slice(0,1000));continue;}
   const j=JSON.parse(t);
   const list=j.obj?.list||j.list||j.episodes||j.data?.list||[];
   console.log('KEYS',Object.keys(j),'COUNT',list.length);
   console.log('FIRST',list.slice(0,2).map(e=>({eid:e.eid,title:e.title,date:e.release_date,url:e.url,duration:e.duration,website:e.website})));
   console.log('LAST',list.slice(-3).map(e=>({eid:e.eid,title:e.title,date:e.release_date,url:e.url,duration:e.duration,website:e.website})));
  }catch(e){console.log('ERR',url,e.message)}
 }
}
