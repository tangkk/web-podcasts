import crypto from 'node:crypto';

const MAP=[24,13,4,19,6,0,8,21,25,7,28,1,15,31,10,9,17,18,22,11,27,23,2,26,12,5,29,14,20,30,16,3];
function nonce(params){
  const m=new Date().toISOString().slice(0,10).replaceAll('-','');
  const keys=Object.keys(params).sort((a,b)=>a.localeCompare(b));
  const q=keys.map(k=>k+'='+params[k]).join('&');
  const h=crypto.createHash('md5').update(q+'evst'+m).digest('hex');
  const n=MAP.map(i=>h[i]).join('');
  return {m,n,q};
}
for(const limit of [50,200,700]){
 const p={cid:3052674,limit,r:1,raw:1,web:1};
 const {m,n,q}=nonce(p);
 const url='https://everest.castbox.fm/data/episode_list/v2?'+q+'&m='+m+'&n='+n;
 const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0','accept':'application/json'}});
 const t=await r.text();
 console.log('\nLIMIT',limit,'STATUS',r.status,'LEN',t.length,'CT',r.headers.get('content-type'));
 try{
  const j=JSON.parse(t); const arr=j?.data?.episode_list||[];
  console.log('COUNT',arr.length);
  console.log('FIRST',JSON.stringify(arr[0]||null));
  console.log('LAST',JSON.stringify(arr.at(-1)||null));
  const old=arr.filter(x=>String(x.release_date||'').startsWith('2020')||String(x.release_date||'').startsWith('2021'));
  console.log('OLDCOUNT',old.length);
  console.log('OLDEST',JSON.stringify(old.at(-1)||null));
 }catch(e){console.log('BODY',t.slice(0,2000))}
}
