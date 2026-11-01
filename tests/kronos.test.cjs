'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {handleKronos}=require('../kronos-render/handler.cjs');
test('Kronos free viewer serves page and reports absent real results without exposing local files',async()=>{
  const server=http.createServer(handleKronos);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const page=await fetch(base+'/kronos/');assert.equal(page.status,200);assert.match(await page.text(),/未来 24 根/);assert.match(page.headers.get('content-security-policy'),/default-src 'self'/);
    for(const file of ['app.js','style.css'])assert.equal((await fetch(base+'/kronos/'+file)).status,200);
    const result=await fetch(base+'/kronos/forecast.json');
    if(result.status===404)assert.match((await result.json()).error,/尚未生成真实预测/);
    else {assert.equal(result.status,200);assert.equal((await result.json()).history.length,512);}
    for(const file of ['forecast.py','handler.cjs','requirements.txt','results/forecast.json','.git/config'])assert.equal((await fetch(base+'/kronos/'+file)).status,404);
    assert.equal((await fetch(base+'/kronos/forecast.json',{method:'POST'})).status,405);
    assert.equal((await fetch(base+'/kronos/app.js',{method:'HEAD'})).headers.get('content-type'),'text/javascript; charset=utf-8');
    const redirect=await fetch(base+'/kronos',{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/kronos/');
  }finally{await new Promise(r=>server.close(r));}
});

test('viewer draws each synthetic path, table and UTC CSV without publishing fixtures',async()=>{
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const start=Date.UTC(2026,0,1),row=(i,offset=0)=>({timestamps:new Date(start+i*3600000).toISOString(),open:100,high:102,low:99,close:100+offset,volume:10,amount:1000});
  const data={metadata:{context:512,horizon:24,symbol:'TESTUSDT',interval:'1h',last_closed_open_time_utc:row(511).timestamps,generated_at_utc:row(512).timestamps,source:'SYNTHETIC TEST ONLY'},history:Array.from({length:512},(_,i)=>row(i)),paths:[0,1,2].map(j=>Array.from({length:24},(_,i)=>row(512+i,j)))};
  class Element {constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.hidden=true;}setAttribute(k,v){this.attrs[k]=v;}append(...items){this.children.push(...items);}click(){this.clicked=true;}}
  const nodes=new Map(),document={querySelector:key=>{if(!nodes.has(key))nodes.set(key,new Element(key));return nodes.get(key);},createElementNS:(_,tag)=>new Element(tag),createElement:tag=>new Element(tag)};
  let blob;
  const context={document,Intl,Date,Blob,URL:class extends URL{static createObjectURL(b){blob=b;return 'blob:test';}static revokeObjectURL(){}},setTimeout:fn=>fn(),fetch:async()=>({ok:true,status:200,json:async()=>data})};
  vm.createContext(context);
  const source=fs.readFileSync(path.join(__dirname,'../kronos-render/app.js'),'utf8').replace(/load\(\);\s*$/,'globalThis.finished=load();');
  vm.runInContext(source,context);await context.finished;
  assert.equal(nodes.get('#result').hidden,false);
  assert.equal(nodes.get('#chart').children.filter(e=>e.tag==='polyline').length,4);
  assert.equal(nodes.get('#rows').children.length,24);
  assert.match(nodes.get('#stale').textContent,/窗口已经过去/);
  nodes.get('#download').onclick();const lines=(await blob.text()).trim().split(/\r?\n/);assert.equal(lines.length,73);assert.match(lines[1],/^1,2026-.*Z,/);
  data.paths[0][0].close=null;await vm.runInContext('load()',context);assert.equal(nodes.get('#result').hidden,true);assert.match(nodes.get('#status').textContent,/无效数值/);
  context.fetch=async url=>{assert.equal(url,'/kronos/config.json');return {ok:true,json:async()=>({spaceUrl:'https://test-kronos.hf.space'})};};
  await vm.runInContext('load()',context);assert.equal(nodes.get('#space-frame').src,'https://test-kronos.hf.space');assert.equal(nodes.get('#online').hidden,false);assert.equal(nodes.get('#status').hidden,true);
});

test('online Space URL configuration only allows a direct HTTPS hf.space origin',()=>{
  const {configuredSpaceUrl}=require('../kronos-render/handler.cjs');
  assert.equal(configuredSpaceUrl('https://test-kronos.hf.space'),'https://test-kronos.hf.space');
  for(const input of ['http://test.hf.space','https://evil.example','https://good.hf.space.evil.com','https://user:secret@good.hf.space','https://good.hf.space/?token=secret','https://good.hf.space/path','javascript:alert(1)','https://good.hf.space:8080'])assert.equal(configuredSpaceUrl(input),null);
});
