'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../kronos-render/generate.js'),'utf8');
function ui(fetch){const nodes=new Map(),timers=[],stored=new Map(),events=[];const document={querySelector:id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,focus(){this.focused=true;}});return nodes.get(id);}};for(const id of ['#generate-symbol','#generate-interval','#generate-paths','#generate-key','#generate-preview'])document.querySelector(id);const context={document,fetch,Date,encodeURIComponent,CustomEvent:function(type,options){this.type=type;this.detail=options.detail;},window:{dispatchEvent:e=>events.push(e)},sessionStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}};vm.createContext(context);vm.runInContext(source,context);return {nodes,timers,stored,events};}
const reply=value=>({ok:true,json:async()=>value});
const tick=()=>new Promise(setImmediate);
test('missing server connection leaves a clear fallback and disabled generate button',async()=>{
 const app=ui(async()=>reply({configured:false}));await tick();assert.equal(app.nodes.get('#generate-submit').disabled,true);assert.match(app.nodes.get('#generate-status').textContent,/连接尚未配置/);
});
test('form submits selected inputs once, polls and emits new data without storing the run key',async()=>{
 const id='11000000-0000-4000-8000-000000000001',requests=[],result={metadata:{symbol:'SOLUSDT'}};
 const app=ui(async(url,options)=>{requests.push({url,options});if(url.endsWith('/config'))return reply({configured:true});if(url.endsWith('/generate'))return reply({task_id:id,message:'submitted'});return reply({state:'completed',message:'complete',run_url:'https://github.com/tholiz888-sudo/hjs/actions/runs/123',result});});await tick();
 const node=id=>app.nodes.get(id);node('#generate-symbol').value='SOLUSDT';node('#generate-interval').value='15m';node('#generate-paths').value='5';node('#generate-key').value='fake-key-for-browser-tests';
 node('#generate-interval').onchange();assert.match(node('#generate-preview').textContent,/6 小时/);
 await node('#generate-form').onsubmit({preventDefault(){}});assert.equal(node('#generate-submit').disabled,true);assert.equal(node('#generate-key').value,'');
 const request=requests.find(r=>r.url.endsWith('/generate'));assert.deepEqual(JSON.parse(request.options.body),{symbol:'SOLUSDT',interval:'15m',paths:5});assert.equal(request.options.headers.Authorization,'Bearer fake-key-for-browser-tests');assert.deepEqual([...app.stored.values()],[id]);
 await node('#generate-form').onsubmit({preventDefault(){}});assert.equal(requests.filter(r=>r.url.endsWith('/generate')).length,1);
 await app.timers.shift()();assert.equal(app.events.length,1);assert.equal(app.events[0].type,'kronos:forecast');assert.deepEqual(app.events[0].detail,result);assert.equal(node('#generate-submit').disabled,false);assert.equal(app.stored.size,0);
});
test('failed generation leaves displayed data intact and exposes a task detail link',async()=>{
 const app=ui(async url=>reply(url.endsWith('/config')?{configured:true}:url.endsWith('/generate')?{task_id:'11000000-0000-4000-8000-000000000001'}:{state:'failed',message:'generation failed',run_url:'https://github.com/tholiz888-sudo/hjs/actions/runs/456'}));await tick();
 for(const [id,value]of Object.entries({'#generate-key':'test-maintainer-key','#generate-symbol':'BTCUSDT','#generate-interval':'1h','#generate-paths':'3'}))app.nodes.get(id).value=value;
 await app.nodes.get('#generate-form').onsubmit({preventDefault(){}});await app.timers.shift()();assert.equal(app.events.length,0);assert.equal(app.nodes.get('#generate-task-link').href,'https://github.com/tholiz888-sudo/hjs/actions/runs/456');assert.equal(app.nodes.get('#generate-submit').disabled,false);
});
