import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from './server.mjs';
import {loadArchive,localize} from './archive.mjs';

test('all successful captured files are present, including 163 actual MP3 files',async()=>{
 const {stats,pages}=loadArchive();assert.equal(stats.available,4860);assert.equal(stats.importComplete,true);assert.equal(stats.mp3,163);
 for(const r of pages.values()){if(!r.available||r.type!=='audio/mpeg')continue;const f=await fs.open(r.filePath,'r');try{const b=Buffer.alloc(512);await f.read(b,0,b.length,0);assert.ok(b.subarray(0,3).toString()==='ID3'||b[0]===255&&(b[1]&224)===224,r.url);assert.ok(!/<html/i.test(b.toString('latin1')),r.url)}finally{await f.close()}}
});

test('public pages preserve original encoding, music supports seeking, missing media remains explicit',async()=>{
 const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${s.address().port}`;
 try{
  let response=await fetch(base+'/');assert.equal(response.status,200);assert.match(new TextDecoder('gb18030').decode(await response.arrayBuffer()),/秘密花园/);
  response=await fetch(base+'/club/love.mp3',{headers:{Range:'bytes=0-1023'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'audio/mpeg');assert.equal(response.headers.get('content-range'),'bytes 0-1023/1558997');assert.equal((await response.arrayBuffer()).byteLength,1024);
  response=await fetch(base+'/club/love.mp3',{headers:{Range:'bytes=999999999-'}});assert.equal(response.status,416);
  assert.equal((await fetch(base+'/meng/meng.mp3')).status,404);assert.equal((await fetch(base+'/club/love.mp3',{method:'HEAD'})).headers.get('content-length'),'1558997');
  assert.equal((await fetch(base+'/liuyan/addok.asp',{method:'POST',body:'test'})).status,405);
  const state=await(await fetch(base+'/api/health')).json();assert.equal(state.importComplete,true);assert.equal(state.complete,false);
 }finally{s.close()}
});

test('same-site links stay local and broken original anti-frame script is isolated',()=>{
 const source=`<script>var ifrs=document.getElementByTagName('iframe');var hostname=location.hostname,\nvar i=ifrs.length;</script><script>var keep=true;</script><a href="http://www.lili.cc/club/garden.html">Enter</a>`;
 const text=localize(Buffer.from(source)).toString();assert.ok(!text.includes('getElementByTagName'));assert.ok(text.includes('var keep=true'));assert.ok(text.includes('href="/club/garden.html"'));
});
