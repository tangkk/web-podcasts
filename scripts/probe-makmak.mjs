const base='https://castbox.fm/channel/%E9%BA%A5%E9%BA%A5%E5%BB%A3%E6%92%AD-id3052674';
for(const skip of [450,500,550]){
 const url=base+'?skip='+skip+'&limit=50';
 const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
 const html=await r.text();
 const m=html.match(/window\.__INITIAL_STATE__\s*=\s*"([^"]+)"/);
 console.log('\nPAGE',skip,'STATUS',r.status,'LEN',html.length,'STATE',!!m);
 if(!m) continue;
 const state=JSON.parse(decodeURIComponent(m[1]));
 const eps=state?.ch?.eps||[];
 console.log('CH', {episode_count:state?.ch?.chInfo?.episode_count,skip:state?.ch?.skip,limit:state?.ch?.limit,count:eps.length});
 console.log('EPS',eps.map(e=>({eid:e.eid,title:e.title,date:e.release_date,url:e.url,duration:e.duration,website:e.website})));
}