const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
test('garden publishing, original-page overrides, media, category visibility, backups and authorization',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'garden-cms-'));let child,port,cookie;
 async function start(){child=spawn(process.execPath,['-e',`const http=require('node:http');const {handleSiteRequest}=require('./server');http.createServer((q,s)=>handleSiteRequest(q,s,{mountPath:'/crypto'})).listen(0,'127.0.0.1',function(){console.log('PORT='+this.address().port)})`],{cwd:path.resolve(__dirname,'..'),env:{...process.env,ADMIN_EMAILS:'garden-owner@example.com',ADMIN_PASSWORD:'test-garden-owner-password',MARKET_AUTO_SYNC:'0',PORTAL_DB_PATH:path.join(dir,'content.sqlite'),RESEARCH_DB_PATH:path.join(dir,'research.sqlite')}});await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('startup timeout '+log)),10000);child.stdout.on('data',data=>{log+=data;const m=log.match(/PORT=(\d+)/);if(m){port=m[1];clearTimeout(timer);resolve()}});child.stderr.on('data',d=>log+=d);child.on('error',reject)})}
 async function stop(){if(child){const p=child;child=null;p.kill();await new Promise(r=>p.once('exit',r))}}
 async function request(p,method='GET',data,authenticated=true,headers={}){const r=await fetch(`http://127.0.0.1:${port}/crypto`+p,{method,headers:{'Content-Type':'application/json',...(authenticated&&cookie?{Cookie:cookie}:{}),...headers},body:data===undefined?undefined:JSON.stringify(data)});const text=await r.text();let value;try{value=JSON.parse(text)}catch{value=text}return{status:r.status,value,headers:r.headers}}
 async function ok(p,m,b){const r=await request(p,m,b);assert.equal(r.status,200,JSON.stringify(r.value));return r.value}
 const api='/admin/api/garden';
 try{
  await start();assert.equal((await request(api+'/pages')).status,401);assert.equal((await request(api+'/preview?id=anything')).status,401);
  const login=await request('/admin/api/login','POST',{email:'garden-owner@example.com',password:'test-garden-owner-password'});assert.equal(login.status,200);cookie=login.headers.getSetCookie().find(c=>!c.includes('Max-Age=0')).split(';')[0];
  assert.match(await ok('/admin'),/data-panel="garden"/);const first=await ok(api+'/pages');assert.ok(first.total>1000);assert.equal(first.items.length,20);
  const media=await ok(api+'/media?type=music');assert.equal(media.items.length,163);const musicId=media.items[0].id;
  const input={id:'new',slug:'garden-test-story',title:'花园测试新篇',category:'shiji',body:'一段安静的文字。\n\n第二段文字。<script>throw 1</script>',summary:'只给管理员看的草稿',status:'draft',musicId};
  assert.equal((await request(api+'/page','POST',input,true,{Origin:'https://untrusted.example'})).status,403);
  let p=(await ok(api+'/page','POST',input)).page;const url='/garden/view'+p.path;assert.equal((await request(url)).status,404);
  const preview=await ok(api+'/preview?id='+p.id);assert.match(preview,/花园测试新篇/);assert.match(preview,/&lt;script&gt;/);assert.doesNotMatch(preview,/<script>throw 1/);
  p=(await ok(api+'/status','POST',{id:p.id,status:'published'})).page;let published=await ok(url);assert.match(published,/花园测试新篇/);assert.match(published,/garden-music/);assert.match(await ok('/garden/view/club/garden.html'),/花园测试新篇/);
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nGsAAAAASUVORK5CYII=';
  const uploaded=(await ok(api+'/upload','POST',{name:'配图.png',data:image})).media;assert.equal((await request('/garden/view'+uploaded.path)).status,200);assert.equal((await request(api+'/upload','POST',{data:'data:image/png;base64,PGh0bWw+'})).status,400);
  p=(await ok(api+'/page','POST',{...p,coverId:uploaded.id})).page;assert.match(await ok(url),new RegExp(uploaded.id));
  const cats=(await ok(api+'/categories')).items,shiji=cats.find(c=>c.id==='shiji');await ok(api+'/categories','POST',{...shiji,enabled:false});assert.equal((await request(api+'/page','POST',p)).status,400);assert.equal((await request(url)).status,404);assert.equal((await request('/garden/view/shiji/shiji.htm')).status,404);assert.doesNotMatch(await ok('/garden/view/club/garden.html'),/href="[^\"]*shiji\/shiji.htm/);
  await ok(api+'/categories','POST',{...shiji,label:'诗与远方'});assert.match(await ok('/garden/view/club/garden.html'),/诗与远方/);
  assert.equal((await request(api+'/categories','POST',{...cats.find(c=>c.id==='home'),enabled:false})).status,400);
  const entry=(await ok(api+'/pages?q='+encodeURIComponent('/club/garden.html'))).items.find(p=>p.path==='/club/garden.html');let legacy=(await ok(api+'/page?id='+entry.id)).page;legacy.title='我的绿色花园';legacy.html=legacy.html.replace('</body>','<p>原页面编辑测试</p></body>');legacy.musicId=musicId;await ok(api+'/page','POST',legacy);assert.match(await ok('/garden/view/club/garden.html'),/原页面编辑测试/);
  const main=await ok('/garden/view/');assert.doesNotMatch(main,/yini\.org|lili\.cc|beian\.miit|ICP[备案]/i);assert.match(main,/club\/garden.html/);
  const backup=await ok('/admin/api/backup');assert.ok(backup.garden.pages.length>=2);await ok(api+'/status','POST',{id:p.id,status:'trash'});assert.equal((await request(url)).status,404);await ok('/admin/api/backup','POST',backup);assert.match(await ok(url),/花园测试新篇/);
  const bad=structuredClone(backup);bad.garden.pages[0].path='/../../secret';assert.equal((await request('/admin/api/backup','POST',bad)).status,400);assert.match(await ok(url),/花园测试新篇/);
  await stop();await start();assert.match(await ok(url),/花园测试新篇/);assert.match(await ok('/garden/view/club/garden.html'),/原页面编辑测试/);
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true})}
});
