const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {render,renderNavigation}=require('../views');
const {handleSiteRequest}=require('../server');

test('portal has a left-rail garden entry and a secondary navigation entry',()=>{
 const page=render('/',new URLSearchParams(),'/crypto').html;
 assert.match(page,/<aside class="left-sidebar">[\s\S]*?<div class="sidebar-heading">秘密花园<\/div>[\s\S]*?href="\/crypto\/garden"/);
 assert.match(renderNavigation('/','/crypto'),/class="garden-nav" href="\/crypto\/garden"/);
});

test('mounted portal serves immersive original garden, scoped music, and return link',async()=>{
 const server=http.createServer((req,res)=>handleSiteRequest(req,res,{mountPath:'/crypto'}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  let response=await fetch(base+'/crypto/garden');const shell=await response.text();assert.equal(response.status,200);assert.match(shell,/href="\/crypto\/">‹ 返回主站/);assert.match(shell,/src="\/crypto\/garden\/view\/"/);assert.match(shell,/sandbox="allow-scripts allow-popups"/);assert.doesNotMatch(shell,/assets\/(?:base|site|home)\.css|primary-nav|right-sidebar/);
  response=await fetch(base+'/crypto/garden/view/');assert.equal(response.status,200);const text=new TextDecoder().decode(await response.arrayBuffer());assert.match(text,/秘密花园/);assert.match(text,/garden2018\.jpg/);
  response=await fetch(base+'/crypto/garden/view/club/love.mp3',{headers:{Range:'bytes=0-1023'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'audio/mpeg');assert.equal((await response.arrayBuffer()).byteLength,1024);
  const health=await(await fetch(base+'/crypto/garden/view/api/health')).json();assert.equal(health.available,4860);assert.equal(health.mp3,163);assert.equal(health.importComplete,true);
  assert.equal((await fetch(base+'/crypto/health')).status,200);assert.equal((await fetch(base+'/crypto/garden/view/meng/meng.mp3')).status,404);
  assert.equal((await fetch(base+'/crypto/garden/view/liuyan/addok.asp',{method:'POST',body:'test'})).status,405);
 }finally{await new Promise(r=>server.close(r))}
});

test('portal standalone mount uses the same garden without hardcoded crypto prefix',async()=>{
 const server=http.createServer((req,res)=>handleSiteRequest(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{const response=await fetch(base+'/garden');const html=await response.text();assert.equal(response.status,200);assert.match(html,/src="\/garden\/view\/"/);assert.match(html,/href="\/">‹ 返回主站/);assert.doesNotMatch(html,/\/crypto\//)}finally{await new Promise(r=>server.close(r))}
});
