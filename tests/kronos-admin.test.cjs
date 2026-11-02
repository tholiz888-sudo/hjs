'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {createStore,DEFAULTS}=require('../kronos-render/store.cjs');
const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../kronos-render/results/forecast.json')));
const clone=()=>structuredClone(original);
function record(delta){const value=clone();value.metadata.generated_at_utc=new Date(Date.parse(value.metadata.generated_at_utc)+delta*1000).toISOString();return value;}
function temp(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'kronos-admin-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('settings and history persist; selected result and deletion tombstones survive restart',t=>{
 const root=temp(t),dbPath=path.join(root,'admin.sqlite'),seedDir=path.join(root,'results');fs.mkdirSync(seedDir);fs.writeFileSync(path.join(seedDir,'forecast.json'),JSON.stringify(original));
 let store=createStore({dbPath,seedDir});const initial=store.currentId(),later=store.add(record(100));assert.equal(store.currentId(),later);store.select(initial);assert.equal(store.settings().autoLatest,false);assert.equal(store.currentId(),initial);
 store.saveSettings({...store.settings(),title:'我的预测页',defaultView:'history',showMedian:false});store.remove(later);assert.throws(()=>store.remove(initial),/当前展示/);store.close();
 fs.mkdirSync(path.join(seedDir,'history'));fs.writeFileSync(path.join(seedDir,'history','forecast-000000000000000000000000.json'),JSON.stringify(record(100)));
 store=createStore({dbPath,seedDir});assert.equal(store.settings().title,'我的预测页');assert.equal(store.settings().showMedian,false);assert.equal(store.list().length,1);assert.equal(store.currentId(),initial);store.close();
});
test('portable backup merge/replace works; invalid backup cannot partially overwrite data',t=>{
 const root=temp(t),source=createStore({dbPath:path.join(root,'source.sqlite'),seedDir:path.join(root,'absent')}),target=createStore({dbPath:path.join(root,'target.sqlite'),seedDir:path.join(root,'absent')});
 const first=source.add(original);source.saveSettings({...DEFAULTS,title:'迁移后的标题',showBand:false});source.select(first);source.add(record(1));const backup=source.backup();
 target.add(record(2));target.restore(backup);assert.equal(target.list().length,3);assert.equal(target.settings().title,'迁移后的标题');assert.equal(target.currentId(),first);
 const before=target.backup(),bad=structuredClone(backup);bad.settings.title='不应该保存';bad.forecasts[1].paths[0].pop();assert.throws(()=>target.restore(bad));assert.deepEqual(target.backup().settings,before.settings);assert.equal(target.list().length,3);
 target.restore({...backup,restoreMode:'replace'});assert.equal(target.list().length,2);assert.equal(target.currentId(),first);source.close();target.close();
});
test('import rejects broken timestamps, zero baseline and invalid settings',t=>{
 const root=temp(t),store=createStore({dbPath:path.join(root,'db.sqlite'),seedDir:path.join(root,'none')});
 for(const mutate of [x=>x.paths[0].pop(),x=>x.history[1].timestamps=x.history[0].timestamps,x=>x.history[0].close=0,x=>x.paths=x.paths.map(()=>structuredClone(x.paths[0]))]){const value=clone();mutate(value);assert.throws(()=>store.add(value));}
 assert.throws(()=>store.saveSettings({...DEFAULTS,defaultInterval:'toString'}));assert.throws(()=>store.saveSettings({...DEFAULTS,defaultPaths:999}));assert.deepEqual(store.settings(),DEFAULTS);assert.equal(store.list().length,0);store.close();
});
test('Kronos admin uses existing administrator session and same-origin write protection',async t=>{
 const root=temp(t);process.env.PORTAL_DB_PATH=path.join(root,'portal.sqlite');process.env.KRONOS_DB_PATH=path.join(root,'kronos.sqlite');
 const {handleAdmin}=require('../crypto-site/admin.cjs');let signed=false;
 const handler=async(req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({user:signed?{email:'admin@example.invalid',isAdmin:true}:null}));};
 const server=http.createServer((req,res)=>handleAdmin(req,res,{base:'/crypto',research:async()=>handler,review:()=>({})}));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 let response=await fetch(base+'/crypto/admin/api/kronos/state');assert.equal(response.status,401);response=await fetch(base+'/crypto/admin/kronos',{redirect:'manual'});assert.equal(response.status,303);
 signed=true;response=await fetch(base+'/crypto/admin/kronos');assert.equal(response.status,200);assert.match(await response.text(),/备份与导入/);
 response=await fetch(base+'/crypto/admin/api/kronos/settings',{method:'PUT',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify(DEFAULTS)});assert.equal(response.status,403);
 response=await fetch(base+'/crypto/admin/api/kronos/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...DEFAULTS,title:'管理员保存的标题'})});assert.equal(response.status,200);
 const state=await(await fetch(base+'/crypto/admin/api/kronos/state')).json();assert.equal(state.settings.title,'管理员保存的标题');assert.ok(state.history.length>=1);
 response=await fetch(base+'/crypto/admin/api/kronos/backup');assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment/);const backup=await response.json();assert.equal(backup.format,'kronos-admin-backup');assert.ok(!JSON.stringify(backup).includes('password'));
 require('../kronos-render/store.cjs').getStore().close();
});
