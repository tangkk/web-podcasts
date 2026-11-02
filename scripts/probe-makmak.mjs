const urls=[
 'https://data.castbox.fm/data/episode_list/v2?cid=3052674&skip=0&limit=700&ascending=0',
 'https://castbox.fm/api/proxy/data/data/episode_list/v2?cid=3052674&skip=0&limit=700&ascending=0'
];
for(const url of urls){
 try{
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0','accept':'application/json'}});
  const t=await r.text();
  console.log('\nURL',url,'STATUS',r.status,'LEN',t.length,'CT',r.headers.get('content-type'));
  console.log('HEAD',t.slice(0,3000));
  try{
    const j=JSON.parse(t);
    const arr=Array.isArray(j)?j:j.episode_list||j.data||[];
    console.log('COUNT',arr.length);
    console.log('FIRST',JSON.stringify(arr[0]||null));
    console.log('LAST',JSON.stringify(arr.at(-1)||null));
    const old=arr.filter(x=>String(x.release_date||x.pub_date||x.published_at||'').startsWith('2020')||String(x.release_date||x.pub_date||x.published_at||'').startsWith('2021'));
    console.log('OLDCOUNT',old.length,'OLDFIRST',JSON.stringify(old[0]||null),'OLDLAST',JSON.stringify(old.at(-1)||null));
  }catch(e){console.log('JSONERR',e.message)}
 }catch(e){console.log('ERR',url,e.message)}
}
