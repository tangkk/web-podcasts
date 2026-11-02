const page='https://castbox.fm/channel/%E9%BA%A5%E9%BA%A5%E5%BB%A3%E6%92%AD-id3052674?limit=607&skip=0';
const html=await (await fetch(page,{headers:{'user-agent':'Mozilla/5.0'}})).text();
const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>m[1]);
console.log('SCRIPTS',JSON.stringify(scripts,null,2));
for(const key of ['__INITIAL','INITIAL_STATE','preloaded','episodes','episodeList','channel_id','channelId','api/','skip','limit']){
 const low=html.toLowerCase(), k=key.toLowerCase(); let p=0,n=0;
 while((p=low.indexOf(k,p))>=0&&n<8){console.log('\nHTML',key,'AT',p,'\n'+html.slice(Math.max(0,p-700),Math.min(html.length,p+1600)).replace(/\s+/g,' '));p+=k.length;n++;}
}
for(const src of scripts.filter(x=>/castbox|ch\.|global|runtime|main/i.test(x)).slice(-10)){
 try{
  const url=new URL(src,'https://castbox.fm').href;
  const js=await (await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}})).text();
  console.log('\nJSFILE',url,'LEN',js.length);
  const paths=[...js.matchAll(/["'](\/[^"']{0,200}(?:episode|channel|podcast)[^"']{0,200})["']/gi)].map(m=>m[1]);
  console.log('PATHS',JSON.stringify([...new Set(paths)].slice(0,100),null,2));
  for(const k of ['/api/','episode','channel','skip','limit']){
   let p=0,n=0,low=js.toLowerCase(),needle=k.toLowerCase();
   while((p=low.indexOf(needle,p))>=0&&n<4){console.log('JSKEY',k,'AT',p,js.slice(Math.max(0,p-500),Math.min(js.length,p+1000)).replace(/\s+/g,' '));p+=needle.length;n++;}
  }
 }catch(e){console.log('JSERR',src,e.message)}
}
