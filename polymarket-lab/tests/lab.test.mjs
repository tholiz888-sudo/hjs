import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {replay,fill,config,fisher} from '../engine.mjs';
import {createServer,listenOptions} from '../server.mjs';
const snapshot=(overrides={})=>({market:'test',time:'2026-01-01T00:00:00Z',observedAt:'2026-01-01T00:00:01Z',end:'2026-01-01T00:15:00Z',up:[[.4,100]],down:[[.5,100]],...overrides});
const settings={feeBps:0,slippageBps:0};
const settlement=winner=>snapshot({time:'2026-01-01T00:15:00Z',observedAt:'2026-01-01T00:15:01Z',up:[],down:[],winner});
test('depth walking uses more expensive levels and proportional fees',()=>{const f=fill([[.2,5],[.4,10]],10,config({feeBps:100,slippageBps:0}));assert.equal(f.cost,3);assert.equal(f.total,3.03);});
test('paired payout reconciles cash for either winner',()=>{for(const winner of ['up','down']){const r=replay([snapshot(),settlement(winner)],settings);assert.equal(r.realized,2);assert.equal(r.cash,1002);assert.equal(r.unpairedRisk,0);assert.equal(r.openCost,0);}});
test('failed second leg remains exposed and can lose',()=>{const open=replay([snapshot({secondLegFails:true})],settings);assert.equal(open.unpairedRisk,8);assert.equal(open.positions[0].down,0);const closed=replay([snapshot({secondLegFails:true}),settlement('down')],settings);assert.equal(closed.realized,-8);assert.equal(closed.cash,992);});
test('fees can eliminate apparent arbitrage',()=>{const r=replay([snapshot({up:[[.49,100]],down:[[.49,100]]})],{...settings,feeBps:300});assert.equal(r.spent,0);});
test('first-leg exposure cap, cash, market limit and depth prevent fills',()=>{for(const c of [{maxExposure:7},{capital:10},{maxMarket:10}])assert.equal(replay([snapshot()],{...settings,...c}).spent,0);assert.equal(replay([snapshot({down:[[.1,1]]})],settings).spent,0);});
test('stale and ended markets are not traded',()=>{assert.equal(replay([snapshot({observedAt:'2026-01-01T00:01:00Z'})],settings).spent,0);assert.equal(replay([snapshot({observedAt:'2026-01-01T00:16:00Z'})],settings).spent,0);});
test('reject malformed, duplicate, inconsistent and future settlement data',()=>{assert.throws(()=>replay([snapshot({up:[[NaN,2]]})]));assert.throws(()=>replay([snapshot(),snapshot()]));assert.throws(()=>replay([snapshot({winner:'up'})]));assert.throws(()=>replay([snapshot()],{capital:-1}));assert.throws(()=>replay([snapshot(),settlement('up')].reverse()));});
test('Fisher handles flat prices without infinite values and uses prior trigger',()=>{const r=fisher(Array(15).fill(100));assert.equal(r[0],null);assert.equal(r[14].value,0);const trend=fisher([1,2,3,4,5,6],3);assert.equal(trend[5].trigger,trend[4].value);assert.ok(Number.isFinite(trend[5].value));});
test('demo includes real loss scenario and reconciles equity',async()=>{const data=JSON.parse(await readFile(new URL('../public/demo.json',import.meta.url)));const r=replay(data);assert.ok(r.events.some(e=>e.action==='单边暴露'));assert.ok(r.events.some(e=>e.pnl<0));assert.ok(Math.abs(r.cash-1000-r.realized)<1e-8);});
test('HTTP serves UI and executes replay; rejects invalid requests',async t=>{const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;assert.match(await(await fetch(base)).text(),/库存交易工作台/);const r=await fetch(base+'/api/replay',{method:'POST',body:JSON.stringify({snapshots:[snapshot(),settlement('up')],config:settings})});assert.equal(r.status,200);assert.equal((await r.json()).realized,2);assert.equal((await fetch(base+'/api/replay',{method:'POST',body:'{}'})).status,400);assert.equal((await fetch(base+'/api/replay',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'})).status,403);});
test('Render health check and HTTPS same-origin replay work',async t=>{const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const host=`127.0.0.1:${server.address().port}`,base=`http://${host}`;const health=await fetch(base+'/healthz');assert.equal(health.status,200);assert.deepEqual(await health.json(),{status:'ok',mode:'paper-only'});const response=await fetch(base+'/api/replay',{method:'POST',headers:{Origin:`https://${host}`},body:JSON.stringify({snapshots:[snapshot()],config:settings})});assert.equal(response.status,200);assert.equal((await response.json()).events[0].action,'模拟配对');});

test('Render binds all interfaces even with stale localhost HOST',()=>{
  assert.deepEqual(listenOptions({RENDER:'true',PORT:'10000'}),{port:10000,host:'0.0.0.0'});
  assert.equal(listenOptions({RENDER_SERVICE_ID:'srv-example',HOST:'127.0.0.1'}).host,'0.0.0.0');
  assert.equal(listenOptions({}).host,'127.0.0.1');
});
