const urls=[
 'https://itunes.apple.com/lookup?id=1520392595&entity=podcastEpisode&limit=200',
 'https://itunes.apple.com/lookup?id=1520392595&entity=podcastEpisode&limit=200&offset=200',
 'https://itunes.apple.com/lookup?id=1520392595&entity=podcastEpisode&limit=200&offset=400',
 'https://itunes.apple.com/hk/lookup?id=1520392595&entity=podcastEpisode&limit=200'
];
for(const url of urls){
 try{
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
  const t=await r.text(); console.log('\nURL',url,'STATUS',r.status,'LEN',t.length);
  const j=JSON.parse(t); const eps=(j.results||[]).filter(x=>x.wrapperType==='podcastEpisode');
  console.log('COUNT',eps.length,'FIRST',eps.slice(0,2).map(x=>({title:x.trackName,date:x.releaseDate,url:x.episodeUrl,id:x.trackId})),
    'LAST',eps.slice(-3).map(x=>({title:x.trackName,date:x.releaseDate,url:x.episodeUrl,id:x.trackId})));
 }catch(e){console.log('ERR',url,e.message)}
}
