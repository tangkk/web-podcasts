const url='https://s3.castbox.fm/webstatic/js/page.ch.6b331ae1.js';
const js=await (await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}})).text();
for(const needle of ['/data/episode_list/v2?cid=','episode_list/v2?','getChEpList','initChannel']){
 let p=0,n=0;
 while((p=js.indexOf(needle,p))>=0&&n<10){
  console.log('\nNEEDLE',needle,'AT',p,'\n'+js.slice(Math.max(0,p-2500),Math.min(js.length,p+4500)));
  p+=needle.length;n++;
 }
}
