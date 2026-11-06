const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('local calculator serves its full asset set, internal navigation and safe static routes',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'position-mount-'));process.env.PORTAL_DB_PATH=path.join(dir,'content.sqlite');
 const {handleSiteRequest}=require('../server');const server=http.createServer((q,r)=>handleSiteRequest(q,r,{mountPath:'/crypto'}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const root=`http://127.0.0.1:${server.address().port}/crypto`,prefix=root+'/position-calculator';
 try{
  const redirect=await fetch(prefix,{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/crypto/position-calculator/');
  const wrapper=await(await fetch(prefix+'/')).text();assert.match(wrapper,/仓位实验室/);assert.match(wrapper,/src="\/crypto\/position-calculator\/app\/"/);assert.doesNotMatch(wrapper,/hjs-6\.onrender/);
  const nav=await(await fetch(root+'/')).text();assert.match(nav,/href="\/crypto\/position-calculator"/);assert.doesNotMatch(nav,/hjs-6\.onrender/);
  const manifest=require('../../position-calculator/portal-dist/manifest.json');
  const crypto=require('node:crypto');
  for(const [name,hash] of Object.entries(manifest.sources))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../position-calculator',name))).digest('hex'),hash,'Rebuild portal assets after source change: '+name);
  for(const name of manifest.files){const response=await fetch(prefix+'/app/'+name);assert.equal(response.status,200,name);assert.ok(Number(response.headers.get('content-length'))>0);if(name.endsWith('.js'))assert.match(response.headers.get('content-type'),/javascript/);if(name.startsWith('assets/'))assert.match(response.headers.get('cache-control'),/immutable/);}
  for(const name of ['scripts/build-portal.mjs','app/page.tsx','manifest.json','assets/unknown.js'])assert.equal((await fetch(prefix+'/app/'+name)).status,404,name);
  assert.equal((await fetch(prefix+'/',{method:'POST'})).status,405);
  assert.match(await(await fetch(root+'/sitemap.xml')).text(),/\/crypto\/position-calculator\//);
 }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
