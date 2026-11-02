for(const skip of [0,450,500,550]){
 const urls=[
  'https://castbox.fm/api/proxy/data/episode_list/v2?cid=3052674&skip='+skip+'&limit=60&web=1',
  'https://data.castbox.fm/episode_list/v2?cid=3052674&skip='+skip+'&limit=60&web=1'
 ];
 for(const url of urls){
  try{
   const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0','accept':'application/json'}});
   const t=await r.text();
   console.log('\nURL',url,'STATUS',r.status,'LEN',t.length,'CT',r.headers.get('content-type'),'HEAD',t.slice(0,120));
   if(!r.ok || !t.trim().startsWith('{')) continue;
   const j=JSON.parse(t);
   const list=j.obj?.list||j.list||j.episodes||j.data?.list||j.data||[];
   console.log('KEYS',Object.keys(j),'COUNT',Array.isArray(list)?list.length:'nonarray');
   if(Array.isArray(list)) console.log('RANGE',list.slice(0,2).concat(list.slice(-3)).map(e=>({eid:e.eid,title:e.title,date:e.release_date,url:e.url,duration:e.duration,website:e.website})));
  }catch(e){console.log('ERR',url,e.message)}
 }
}