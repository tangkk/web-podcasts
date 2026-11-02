const base='https://castbox.fm/channel/%E9%BA%A5%E9%BA%A5%E5%BB%A3%E6%92%AD-id3052674';
for(const skip of [0,100,200,300,400,500,560]){
 const url=base+'?limit=20&skip='+skip;
 try{
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
  const html=await r.text();
  const rows=[...html.matchAll(/<a href="(\/episode\/[^"]+)"[^>]*><p title="([^"]+)"[^>]*>[\s\S]*?<span class="item icon date">([^<]+)<\/span><span class="item icon time">([^<]+)<\/span>/g)]
    .map(m=>({link:m[1],title:m[2],date:m[3],duration:m[4]}));
  const urls=[...html.matchAll(/%22url%22%3A%22(https%3A%2F%2Fanchor\.fm%2Fs%2F284eb8f8%2Fpodcast%2Fplay%2F[^%"]+(?:%25[^%"]+)*?\.mp3)%22/g)].map(m=>decodeURIComponent(m[1]));
  console.log('\nSKIP',skip,'STATUS',r.status,'LEN',html.length,'ROWS',rows.length,'URLS',urls.length);
  console.log('FIRSTROWS',JSON.stringify(rows.slice(0,3)));
  console.log('LASTROWS',JSON.stringify(rows.slice(-3)));
  console.log('FIRSTURL',urls[0]||'');
  console.log('LASTURL',urls.at(-1)||'');
 }catch(e){console.log('ERR',skip,e.message)}
}
