const feed='https://anchor.fm/s/284eb8f8/podcast/rss';
const cdx='https://web.archive.org/cdx/search/cdx?url='+encodeURIComponent(feed)+'&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&filter=mimetype:application/rss%2Bxml&collapse=digest&from=2020&to=2022';
for (const url of [
  cdx,
  'https://web.archive.org/cdx/search/cdx?url='+encodeURIComponent(feed)+'&output=json&fl=timestamp,original,statuscode,mimetype,digest&filter=statuscode:200&collapse=digest&from=2020&to=2022'
]) {
  try {
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
    const t=await r.text();
    console.log('CDX',r.status,url,'LEN',t.length,'\n',t.slice(0,20000));
  } catch(e){console.log('CDX ERROR',e.message);}
}
