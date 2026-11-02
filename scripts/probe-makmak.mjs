const feeds=[
  'https://anchor.fm/s/284eb8f8/podcast/rss',
  'https://anchor.fm/s/284eb8f8/podcast/rss/',
  'http://anchor.fm/s/284eb8f8/podcast/rss'
];
for (const feed of feeds) {
  const cdx='https://web.archive.org/cdx/search/cdx?url='+encodeURIComponent(feed)+'&output=json&filter=statuscode:200&collapse=digest&from=2020&to=2022&fl=timestamp,original,statuscode,mimetype,digest&limit=2000';
  try {
    const r=await fetch(cdx,{headers:{'user-agent':'Mozilla/5.0'}});
    const t=await r.text();
    console.log('\nCDX',feed,'STATUS',r.status,'LEN',t.length);
    console.log(t.slice(0,20000));
  } catch(e) { console.log('ERR',feed,e.message); }
}
