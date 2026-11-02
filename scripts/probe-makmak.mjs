const bases=[
 'https://data.castbox.fm',
 'https://data3.castbox.fm',
 'https://everest.castbox.fm',
 'https://everest3.castbox.fm'
];
const paths=[
 '/data/episode_list/v2?cid=3052674&skip=0&limit=5&ascending=0',
 '/episode_list/v2?cid=3052674&skip=0&limit=5&ascending=0'
];
for(const base of bases){
 for(const path of paths){
  const url=base+path;
  try{
   const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0','accept':'application/json'}});
   const t=await r.text();
   console.log('URL',url,'STATUS',r.status,'CT',r.headers.get('content-type'),'LEN',t.length,'HEAD',t.slice(0,500).replace(/\s+/g,' '));
  }catch(e){console.log('ERR',url,e.message)}
 }
}
