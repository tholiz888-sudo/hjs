import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplication} from '../server/index.mjs';
import {localize} from '../projects/yini-website/archive.mjs';

test('garden archive is isolated under its column and preserves main application APIs',async()=>{
 const app=createApplication({dbPath:':memory:',autoMarket:false});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
 try{
  let r=await fetch(base+'/api/health');const main=await r.json();assert.equal(main.service,'jiange-local');
  r=await fetch(base+'/garden/view');assert.equal(new URL(r.url).pathname,'/garden/view/');assert.equal(r.status,200);
  r=await fetch(base+'/garden/view/api/health');const archive=await r.json();assert.equal(archive.importComplete,true);assert.equal(archive.mp3,163);
  r=await fetch(base+'/garden/view/club/love.mp3',{headers:{Range:'bytes=0-1023'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-type'),'audio/mpeg');assert.equal((await r.arrayBuffer()).byteLength,1024);
  r=await fetch(base+'/garden/view/meng/meng.mp3');assert.equal(r.status,404);
  r=await fetch(base+'/garden/view/liuyan/addok.asp',{method:'POST',body:'test'});assert.equal(r.status,405);
  assert.equal((await fetch(base+'/api/session')).status,200);
 }finally{await app.close()}
});

test('archive absolute and root-relative links stay inside the garden prefix',()=>{
 const html=`<a href="http://www.yini.org/club/garden.html">Enter</a><img src="/photo.jpg"><div style="background:url('/bg.gif')"></div><script>var src="http://lili.cc/song.mp3"</script>`;
 const text=localize(Buffer.from(html),'/garden/view').toString();assert.ok(text.includes('href="/garden/view/club/garden.html"'));assert.ok(text.includes('src="/garden/view/photo.jpg"'));assert.ok(text.includes("url('/garden/view/bg.gif')"));assert.ok(text.includes('"/garden/view/song.mp3"'));assert.ok(!text.includes('/garden/view/garden/view'));
});
