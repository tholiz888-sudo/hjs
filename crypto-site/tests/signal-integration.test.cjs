const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
test('full local signal app mounts pages, navigation, private market API and bounded original exchange adapter',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'signal-integration-'));process.env.PORTAL_DB_PATH=path.join(dir,'content.sqlite');
 const {handleSiteRequest}=require('../server'),server=http.createServer((q,r)=>handleSiteRequest(q,r,{mountPath:'/crypto'}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/crypto`,prefix=base+'/ten-minute',originalFetch=global.fetch;let calls=0,limited=false;
 const now=Date.now(),boundary=Math.floor(now/60000)*60000,wire=Array.from({length:150},(_,i)=>{const time=boundary-(150-i)*60000;return [time,'100','102','99','101','10',time+59999]});
 global.fetch=async(url,options)=>{if(String(url).startsWith(base))return originalFetch(url,options);assert.ok(String(url).startsWith('https://data-api.binance.vision/api/v3/'));calls++;if(limited)return Response.json({},{status:429,headers:{'Retry-After':'3'}});return Response.json(String(url).includes('/time')?{serverTime:now}:wire);};
 try{
  const redirect=await fetch(prefix,{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/crypto/ten-minute/');
  const wrapper=await(await fetch(prefix+'/')).text();assert.match(wrapper,/十分钟事件合约/);assert.match(wrapper,/src="\/crypto\/ten-minute\/app\/"/);assert.doesNotMatch(wrapper,/hjs-7/);
  const nav=(await(await fetch(base+'/')).text()).split('</header>')[0];assert.match(nav,/href="\/crypto\/ten-minute">十分钟事件合约<\/a>$/);
  for(const route of ['/app/','/app/rules','/app/backtest']){const response=await fetch(prefix+route);assert.equal(response.status,200);const html=await response.text();assert.match(html,/data-api="\/crypto\/ten-minute\/api\/market"/);assert.doesNotMatch(html,/__SIGNAL_|hjs-7/);}
  const manifest=require('../../signal-dashboard/portal-dist/manifest.json');for(const file of manifest.files){const response=await fetch(prefix+'/app/'+file);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/immutable/);}
  for(const [name,hash] of Object.entries(manifest.sources))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../signal-dashboard',name))).digest('hex'),hash,'Rebuild signal resources: '+name);
  for(const file of ['market.cjs','manifest.json','../portal/build.mjs','app/page.tsx'])assert.equal((await fetch(prefix+'/app/'+file)).status,404);
  assert.equal((await fetch(prefix+'/api/market?symbol=UNSAFE')).status,400);assert.equal(calls,0);
  const response=await fetch(prefix+'/api/market?symbol=BTCUSDT');assert.equal(response.status,200);const snapshot=await response.json();assert.equal(snapshot.source,'binance');assert.equal(snapshot.candles.length,150);assert.equal(snapshot.symbol,'BTCUSDT');assert.match(response.headers.get('cache-control'),/no-store/);const after=calls;
  assert.equal((await fetch(prefix+'/api/market?symbol=BTCUSDT')).status,200);assert.equal(calls,after,'shared cache avoids duplicate upstream requests');
  limited=true;const rate=await fetch(prefix+'/api/market?symbol=ETHUSDT');assert.equal(rate.status,429);assert.equal(rate.headers.get('retry-after'),'3');assert.match((await rate.json()).error,/限流/);
  assert.equal((await fetch(prefix+'/api/market',{method:'POST'})).status,405);assert.match(await(await fetch(base+'/sitemap.xml')).text(),/\/crypto\/ten-minute\//);
 }finally{global.fetch=originalFetch;await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
