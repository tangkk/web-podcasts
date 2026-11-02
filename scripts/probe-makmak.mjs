const qs=[
 'https://web.archive.org/cdx/search/cdx?url=anchor.fm%2Fhkcropcircle*%26output=json'
];
const urls=[
 'https://web.archive.org/cdx/search/cdx?url=anchor.fm/hkcropcircle/*&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&collapse=urlkey&from=2020&to=2022&limit=5000',
 'https://web.archive.org/cdx/search/cdx?url=www.anchor.fm/hkcropcircle/*&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&collapse=urlkey&from=2020&to=2022&limit=5000',
 'https://web.archive.org/cdx/search/cdx?url=anchor.fm/hkcropcircle&matchType=prefix&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&from=2020&to=2022&limit=5000'
];
for(const url of urls){
 try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});const t=await r.text();console.log('\nCDX',r.status,'LEN',t.length,'\n',t.slice(0,50000));}catch(e){console.log('ERR',e.message)}
}
