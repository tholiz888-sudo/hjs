'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createGenerationApi}=require('../kronos-render/generation.cjs');
const env={KRONOS_GITHUB_TOKEN:'fake-token-for-transport-tests',KRONOS_RUN_KEY:'fake-maintainer-key-for-tests'};
async function fixture(t,options){const api=createGenerationApi(options),server=http.createServer((req,res)=>api(req,res,new URL(req.url,'http://localhost').pathname));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));return `http://127.0.0.1:${server.address().port}`;}
const reply=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});
const post=(base,body,key=env.KRONOS_RUN_KEY,headers={})=>fetch(base+'/kronos/api/generate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,...headers},body:JSON.stringify(body)});
const inputs={symbol:'ETHUSDT',interval:'4h',paths:3};
test('generation refuses absent configuration, bad keys, foreign origin and invalid choices without contacting GitHub',async t=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('must not reach GitHub');};
 let base=await fixture(t,{env:{},fetchImpl});let r=await fetch(base+'/kronos/api/config');assert.equal((await r.json()).configured,false);assert.equal((await post(base,inputs)).status,503);
 base=await fixture(t,{env,fetchImpl});assert.equal((await post(base,inputs,'bad-key')).status,401);assert.equal((await post(base,inputs,env.KRONOS_RUN_KEY,{Origin:'https://foreign.example'})).status,403);
 assert.equal((await post(base,{...inputs,symbol:'$(malicious)'})).status,400);assert.equal((await post(base,{...inputs,paths:100})).status,400);assert.equal((await post(base,null)).status,400);assert.equal(calls,0);
});
test('dispatch is correlated to one run; polling survives restart and returns matching data without exposing keys',async t=>{
 let time=100000,dispatch=null,status='in_progress';
 const fetchImpl=async(url,options)=>{
  assert.ok(url.startsWith('https://api.github.com/repos/tholiz888-sudo/hjs'));assert.equal(options.headers.Authorization,'Bearer '+env.KRONOS_GITHUB_TOKEN);
  if(url.endsWith('/hjs'))return reply({private:false});
  if(url.includes('/dispatches')){dispatch=JSON.parse(options.body);return reply(null,204);}
  if(url.includes('/runs?'))return reply({workflow_runs:dispatch?[{id:123456,display_title:'Kronos ETHUSDT ['+dispatch.inputs.request_id+']',status,conclusion:status==='completed'?'success':null}]:[]});
  if(url.includes('/contents/')){const result={metadata:{run_url:'https://github.com/tholiz888-sudo/hjs/actions/runs/123456'},history:Array(512).fill({}),paths:[Array(24).fill({}),Array(24).fill({}),Array(24).fill({})]};return reply({encoding:'base64',size:10000,content:Buffer.from(JSON.stringify(result)).toString('base64')});}
  throw Error('unexpected endpoint');
 };
 const options={env,fetchImpl,now:()=>time};let base=await fixture(t,options);
 const response=await post(base,inputs);assert.equal(response.status,202);const queued=await response.json();assert.match(queued.task_id,/^[a-f0-9-]{36}$/);assert.equal(dispatch.ref,'main');assert.deepEqual(dispatch.inputs,{...inputs,paths:'3',request_id:queued.task_id});
 assert.equal((await post(base,inputs)).status,429);
 time+=9000;let data=await(await fetch(base+'/kronos/api/tasks/'+queued.task_id)).json();assert.equal(data.state,'running');assert.equal(data.run_url,'https://github.com/tholiz888-sudo/hjs/actions/runs/123456');
 status='completed';base=await fixture(t,options);data=await(await fetch(base+'/kronos/api/tasks/'+queued.task_id)).json();assert.equal(data.state,'completed');assert.equal(data.result.paths.length,3);assert.equal(data.result.history.length,512);
 const text=JSON.stringify(data);assert.ok(!text.includes(env.KRONOS_GITHUB_TOKEN));assert.ok(!text.includes(env.KRONOS_RUN_KEY));
});
test('private repos and busy workflows cannot be dispatched',async t=>{
 for(const mode of ['private','busy']){let dispatched=false;const base=await fixture(t,{env,fetchImpl:async url=>{if(url.endsWith('/hjs'))return reply({private:mode==='private'});if(url.includes('/runs?'))return reply({workflow_runs:[{status:'queued'}]});dispatched=true;return reply(null,204);}});assert.equal((await post(base,inputs)).status,409);assert.equal(dispatched,false);}
});
test('failed tasks preserve existing result; successful mismatched result stays in publishing state',async t=>{
 const id='11000000-0000-4000-8000-000000000001';
 for(const mode of ['failed','mismatch']){const base=await fixture(t,{env,fetchImpl:async url=>{if(url.includes('/runs?'))return reply({workflow_runs:[{id:99,display_title:'['+id+']',status:'completed',conclusion:mode==='failed'?'failure':'success'}]});return reply({encoding:'base64',size:50,content:Buffer.from(JSON.stringify({metadata:{run_url:'other-run'}})).toString('base64')});}});const data=await(await fetch(base+'/kronos/api/tasks/'+id)).json();assert.equal(data.state,mode==='failed'?'failed':'publishing');assert.equal(data.result,undefined);}
});
