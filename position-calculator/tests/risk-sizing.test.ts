import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAN } from '../lib/types';
import { simplePlan, simpleText } from '../lib/simple';
import { calculate } from '../lib/calculations';
test('account risk sizing matches 2% budget at 2%, 5% and 10% stop distances and separates leverage',()=>{
 for(const [stop,notional] of [['98','10000'],['95','4000'],['90','2000']]){
  for(const leverage of ['1','5']){
   const plan=simplePlan({...DEFAULT_PLAN,equity:'10000',risk:'2',entry:'100',stop,leverage,costMode:'price'},'risk');const c=calculate(plan,{includeTargets:false});assert.ok(c.ok);if(!c.ok)return;
   assert.equal(c.result.budget.toFixed(),'200');assert.equal(c.result.notional.toFixed(),notional);assert.equal(c.result.margin.toFixed(),String(Number(notional)/Number(leverage)));assert.equal(c.result.loss.toFixed(),'200');assert.match(simpleText(plan,c.result),/单笔风险比例：2%/);
  }
 }
});
test('risk sizing includes configured costs in the same budget, supports shorts and rejects wrong stops',()=>{
 const plan=simplePlan({...DEFAULT_PLAN,equity:'10000',risk:'2',entry:'100',stop:'110',leverage:'5',direction:'short',costMode:'total'},'risk');const c=calculate(plan,{includeTargets:false});assert.ok(c.ok);if(!c.ok)return;
 assert.ok(c.result.loss.lte(200));assert.ok(c.result.notional.lt(2000));
 assert.equal(calculate({...plan,stop:'90'},{includeTargets:false}).ok,false);
});
test('inverse simple mode also supports account percentage instead of a fixed loss amount',()=>{
 for(const direction of ['long','short'] as const){
  const p=simplePlan({...DEFAULT_PLAN,direction,equity:'10000',risk:'2',riskMode:'percent',marginInput:'400',entry:'100',leverage:'5',costMode:'price'},'stop');const c=calculate(p,{includeTargets:false});assert.ok(c.ok);if(!c.ok)return;
  assert.equal(c.result.budget.toFixed(),'200');assert.equal(c.result.stop.toFixed(),direction==='long'?'90':'110');assert.equal(c.result.loss.toFixed(),'200');assert.match(simpleText(p,c.result),/最多亏损预算：200 USDT/);
 }
});
