import vm from 'node:vm';
const url='https://s3.castbox.fm/webstatic/js/page.ch.6b331ae1.js';
const js=await (await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}})).text();
let payload=null;
const arr=[];
arr.push=(x)=>{payload=x;return 1};
const sandbox={window:{webpackJsonp:arr},self:{},console};
try{vm.runInNewContext(js,sandbox,{timeout:5000});}catch(e){console.log('VMERR',e.message)}
console.log('PAYLOAD',!!payload,Array.isArray(payload),payload?.length);
const mods=payload?.[1];
console.log('MODTYPE',typeof mods,Array.isArray(mods),mods?Object.keys(mods).slice(0,30):null,'HAS337',!!mods?.[337]);
if(mods?.[337]) console.log('MODULE337\n'+mods[337].toString());
for(const id of [312,320,334,337,529]) if(mods?.[id]) console.log('\nMODULE',id,'\n'+mods[id].toString().slice(0,20000));
