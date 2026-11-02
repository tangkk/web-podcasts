const base='https://www.podcastrepublic.net';
const html=await (await fetch(base+'/podcast/1520392595',{headers:{'user-agent':'Mozilla/5.0'}})).text();
for (const key of ['episode_title','episodeTitle','btnPlay','playEpisode','episode_id','episodeId','loadMore','Show more','pagination','data-id','data-url','audio']) {
 let p=0,n=0; const low=html.toLowerCase(), k=key.toLowerCase();
 while((p=low.indexOf(k,p))>=0 && n<5){console.log('\nHTML KEY',key,'AT',p,'\n'+html.slice(Math.max(0,p-1200),Math.min(html.length,p+2200)).replace(/\s+/g,' '));p+=k.length;n++;}
}
const js=await (await fetch(base+'/js/main.js',{headers:{'user-agent':'Mozilla/5.0'}})).text();
console.log('\nMAINJS LEN',js.length);
for (const key of ['ajax','episode','podcast','play','audio','load','page','offset','/api','$.get','$.post']) {
 let p=0,n=0; const low=js.toLowerCase(), k=key.toLowerCase();
 while((p=low.indexOf(k,p))>=0 && n<10){console.log('\nJS KEY',key,'AT',p,'\n'+js.slice(Math.max(0,p-800),Math.min(js.length,p+1600)).replace(/\s+/g,' '));p+=k.length;n++;}
}
