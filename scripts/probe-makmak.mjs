const url='https://s3.castbox.fm/webstatic/js/page.ch.6b331ae1.js';
const js=await (await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}})).text();
for(const needle of ['castboxHostName','/api/proxy/data','function(e,t){return fetch','Content-Type','application/json','credentials','method:"POST"','method:"GET"']){
 let p=0,n=0;
 while((p=js.indexOf(needle,p))>=0&&n<12){
  console.log('\nNEEDLE',needle,'AT',p,'\n'+js.slice(Math.max(0,p-3500),Math.min(js.length,p+5500)));
  p+=needle.length;n++;
 }
}