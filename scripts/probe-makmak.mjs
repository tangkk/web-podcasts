import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const SHOW_PATH = 'shows/mak-mak-radio.json';
const CID = 3052674;
const CUTOFF = Date.parse('2022-01-03T10:00:00Z');
const MAP=[24,13,4,19,6,0,8,21,25,7,28,1,15,31,10,9,17,18,22,11,27,23,2,26,12,5,29,14,20,30,16,3];

function nonce(params){
  const m=new Date().toISOString().slice(0,10).replaceAll('-','');
  const keys=Object.keys(params).sort((a,b)=>a.localeCompare(b));
  const q=keys.map(k=>k+'='+params[k]).join('&');
  const h=crypto.createHash('md5').update(q+'evst'+m).digest('hex');
  const n=MAP.map(i=>h[i]).join('');
  return {m,n,q};
}

function clean(value=''){
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/\s+/g,' ')
    .trim();
}

function duration(ms){
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const sec=Math.round(ms/1000);
  const h=Math.floor(sec/3600);
  const m=Math.floor((sec%3600)/60);
  const s=sec%60;
  return h>0 ? [h,m,s].map((v,i)=>i===0?String(v):String(v).padStart(2,'0')).join(':')
             : [m,s].map(v=>String(v).padStart(2,'0')).join(':');
}

async function playable(url){
  try{
    const r=await fetch(url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'user-agent':'WebPodcasts/1.0'}});
    if (r.ok || (r.status>=300 && r.status<400)) return true;
  }catch{}
  try{
    const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'user-agent':'WebPodcasts/1.0','range':'bytes=0-0'}});
    if (r.body) await r.body.cancel().catch(()=>{});
    return r.ok || r.status===206;
  }catch{
    return false;
  }
}

const p={cid:CID,limit:700,r:1,raw:1,web:1};
const {m,n,q}=nonce(p);
const api='https://everest.castbox.fm/data/episode_list/v2?'+q+'&m='+m+'&n='+n;
const response=await fetch(api,{headers:{'user-agent':'Mozilla/5.0','accept':'application/json'},signal:AbortSignal.timeout(30000)});
if(!response.ok) throw new Error('Castbox HTTP '+response.status);
const payload=await response.json();
const all=payload?.data?.episode_list||[];
if(all.length<500) throw new Error('Unexpected Castbox episode count: '+all.length);

const candidates=all.filter(ep=>{
  const t=Date.parse(ep.release_date||'');
  return Number.isFinite(t) && t<CUTOFF && typeof ep.url==='string' && ep.url.includes('anchor.fm/s/284eb8f8/podcast/play/');
});
console.log('Castbox total:',all.length,'old candidates:',candidates.length);

const verified=[];
for(let i=0;i<candidates.length;i+=8){
  const batch=candidates.slice(i,i+8);
  const ok=await Promise.all(batch.map(async ep=>({ep,ok:await playable(ep.url)})));
  verified.push(...ok.filter(x=>x.ok).map(x=>x.ep));
  console.log('Verified',Math.min(i+8,candidates.length),'/',candidates.length,'playable so far',verified.length);
}
if(!verified.length) throw new Error('No old episodes verified playable');

const show=JSON.parse(await fs.readFile(SHOW_PATH,'utf8'));
const recovered=verified.map(ep=>({
  id: String(ep.episode_id||ep.eid),
  title: ep.title||'未命名單集',
  description: clean(ep.description||'').slice(0,420),
  publishedAt: new Date(ep.release_date).toISOString(),
  duration: duration(ep.duration),
  audio: ep.url,
  link: ep.website || `https://castbox.fm/episode/${encodeURIComponent(ep.title||'episode')}-id${CID}-id${ep.eid}`
}));

const merged=new Map();
for(const ep of [...(show.episodes||[]),...recovered]){
  const key=ep.audio||ep.id||ep.link;
  if(key) merged.set(key,{...(merged.get(key)||{}),...ep});
}
show.episodes=[...merged.values()]
  .filter(ep=>typeof ep.audio==='string'&&ep.audio)
  .sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0))
  .slice(0,5000);

await fs.writeFile(SHOW_PATH,JSON.stringify(show,null,2)+'\n');
const oldest=show.episodes.at(-1);
console.log('Recovered playable old episodes:',recovered.length);
console.log('Final episode count:',show.episodes.length);
console.log('Oldest:',JSON.stringify(oldest));
