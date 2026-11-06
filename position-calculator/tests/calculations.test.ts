import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, D, format, netAtPrice, type Result } from '../lib/calculations';
import { DEFAULT_PLAN, type Plan } from '../lib/types';
import { planText } from '../lib/plan-text';
import { isPlan, parsePlan } from '../lib/storage';
const plan=(over:Partial<Plan>={}):Plan=>({...structuredClone(DEFAULT_PLAN),riskMode:'percent',leverage:'5',...over});
function result(p:Plan):Result {const c=calculate(p);assert.ok(c.ok,JSON.stringify(c));return c.result;}
function close(a:InstanceType<typeof D>,b:string){assert.ok(a.minus(b).abs().lt('0.0000000000001'),`${a} != ${b}`)}
test('BTC long includes all costs and floors quantity within budget',()=>{
 const r=result(plan());assert.equal(r.budget.toFixed(),'25');assert.equal(r.distance.toFixed(),'600');assert.equal(r.quantity.toFixed(),'0.035716');assert.equal(r.notional.toFixed(),'3578.7432');assert.equal(r.margin.toFixed(),'715.74864');assert.equal(r.loss.toFixed(),'24.99977136');assert.ok(r.loss.lte(r.budget));assert.equal(r.targets[0].price.toFixed(),'101100');assert.equal(r.targets[1].price.toFixed(),'102000');assert.equal(r.feasible,true);assert.equal(r.targets[0].net.toFixed(),'28.55279904');assert.equal(r.targets[1].net.toFixed(),'60.68434128');assert.equal(r.totalNet.toFixed(),'44.61857016');assert.equal(r.partialStop.toFixed(),'1.77651384');
 assert.equal(r.costs.price.toFixed(),'21.4296');assert.equal(r.costs.opening.toFixed(),'1.43149728');assert.equal(r.costs.closing.toFixed(),'1.42292544');assert.equal(r.costs.slippage.toFixed(),'0.71574864');
});
test('ETH short targets and gross/net profits follow short direction',()=>{
 const p=plan({symbol:'ETHUSDT',direction:'short',entry:'3500',stop:'3550',quantityStep:'0.001',minQuantity:'0.001',priceStep:'0.01'}),r=result(p);
 assert.equal(r.quantity.toFixed(),'0.467');assert.equal(r.targets[0].net.toFixed(),'33.40451');assert.equal(r.distance.toFixed(),'50');assert.equal(r.targets[0].price.toFixed(),'3425');assert.equal(r.targets[1].price.toFixed(),'3350');assert.ok(r.targets[1].net.gt(r.targets[0].net));assert.ok(netAtPrice(p,r,'3600').lt(0));assert.ok(r.loss.lte(r.budget));
});
test('more risk increases position; wider stop lowers it',()=>{const a=result(plan()),b=result(plan({risk:'1'})),c=result(plan({stop:'99000'}));assert.ok(b.quantity.gt(a.quantity));assert.ok(c.quantity.lt(a.quantity));});
test('leverage changes only margin, not quantity or notional',()=>{const a=result(plan()),b=result(plan({leverage:'10'}));assert.ok(a.quantity.eq(b.quantity));assert.ok(a.notional.eq(b.notional));assert.ok(a.margin.eq(b.margin.mul(2)));});
test('higher entry/exit fees, slippage and funding never increase size',()=>{const base=result(plan());for(const k of ['openFee','closeFee','slippage','funding']){const higher=result(plan({[k]:'1'}));assert.ok(higher.quantity.lte(base.quantity));assert.ok(higher.loss.lte(higher.budget));}});
test('same price move gives opposite P&L for long and short without costs',()=>{const a=plan({openFee:'0',closeFee:'0',slippage:'0',funding:'0'}),b=plan({...a,direction:'short',stop:'100800'}),ra=result(a),rb=result(b);assert.ok(ra.quantity.eq(rb.quantity));const long=netAtPrice(a,ra,'100300'),short=netAtPrice(b,rb,'100300');assert.ok(long.gt(0));assert.ok(short.lt(0));assert.ok(long.eq(short.neg()));});
test('weighted net profit equals sum of batch profits and TP1/stop allocates all costs once',()=>{
 const p=plan(),r=result(p);assert.ok(r.totalNet.eq(r.targets[0].batchNet.plus(r.targets[1].batchNet)));assert.ok(r.partialStop.eq(r.targets[0].batchNet.minus(r.loss.mul('.5'))));assert.ok(r.totalNet.eq(r.targets[0].net.mul('.5').plus(r.targets[1].net.mul('.5'))));assert.ok(r.weightedGrossR.eq('2.25'));assert.ok(r.weightedNetR.eq(r.totalNet.div(r.loss)));
});
test('break-even includes exit fee for long and short',()=>{for(const p of [plan(),plan({direction:'short',stop:'100800',funding:'0.05'})]){const r=result(p);close(netAtPrice(p,r,r.breakEven),'0');}});
test('explicit price targets match R-generated targets',()=>{const p=plan({targets:[{mode:'price',value:'101100',share:'40'},{mode:'price',value:'102000',share:'60'}]}),r=result(p);assert.ok(r.targets[0].grossR.eq('1.5'));assert.ok(r.targets[1].grossR.eq(3));assert.ok(r.totalNet.eq(r.targets[0].net.mul('.4').plus(r.targets[1].net.mul('.6'))));});
test('invalid inputs never produce a calculation',()=>{
 const bad:Partial<Plan>[]=[{equity:'0'},{equity:'-1'},{entry:'0'},{stop:''},{stop:'100201'},{direction:'short'},{leverage:'0'},{leverage:'201'},{risk:'6'},{maxRisk:'101'},{openFee:'-1'},{funding:'11'},{slippage:'NaN'},{equity:'Infinity'},{entry:'abc'},{quantityStep:'0'},{priceStep:'0'},{priceDecimals:'13'},{priceDecimals:'1.5'},{symbol:'CUSTOM',customSymbol:''}];
 for(const p of bad)assert.equal(calculate(plan(p)).ok,false,JSON.stringify(p));
});
test('reject wrong target direction, short negative target, unordered targets and invalid shares',()=>{
 const cases:Plan[]=[plan({targets:[{mode:'price',value:'99000',share:'50'},{mode:'r',value:'3',share:'50'}]}),plan({direction:'short',entry:'100',stop:'200'}),plan({targets:[{mode:'r',value:'4',share:'50'},{mode:'r',value:'3',share:'50'}]}),plan({targets:[{mode:'r',value:'1.5',share:'40'},{mode:'r',value:'3',share:'50'}]}),plan({targets:[{mode:'r',value:'1.5',share:'-10'},{mode:'r',value:'3',share:'110'}]})];
 for(const p of cases)assert.equal(calculate(p).ok,false);
});
test('margin overflow, minimum quantity and price precision yield actionable warnings',()=>{
 assert.equal(result(plan({risk:'5',leverage:'1'})).feasible,false);
 assert.ok(result(plan({minQuantity:'1'})).warnings.some(w=>w.includes('最小数量')));
 assert.ok(result(plan({priceStep:'0.001'})).warnings.some(w=>w.includes('精度')));
 assert.ok(result(plan({entry:'100200.01'})).warnings.some(w=>w.includes('价格步长')));
});
test('batch quantities must respect configured steps and minimums',()=>{const r=result(plan({quantityStep:'0.00001'}));assert.ok(r.warnings.some(w=>w.includes('分批数量')));});
test('tiny prices and high precision remain finite and preserve risk bound',()=>{
 const p=plan({symbol:'CUSTOM',customSymbol:'TINYUSDT',entry:'0.000000000123',stop:'0.000000000120',priceStep:'0.000000000001',priceDecimals:'12',minQuantity:'1',quantityStep:'1'}),r=result(p);assert.ok(r.quantity.isFinite());assert.ok(r.loss.lte(r.budget));assert.ok(r.quantity.gt(0));assert.ok(r.targets.every(t=>t.net.isFinite()));
});
test('zero rounded quantity remains safe without NaN or Infinity',()=>{const r=result(plan({equity:'0.00000001'}));assert.ok(r.quantity.eq(0));assert.equal(r.feasible,false);assert.ok(r.targets.every(t=>t.netR.isFinite()&&t.roi.isFinite()));});
test('format groups only integer portion; trade plan uses calculated data',()=>{assert.equal(format('0.123456789',9),'0.123456789');assert.equal(format('1234567.89123',5),'1,234,567.89123');const p=plan(),r=result(p),text=planText(p,r);assert.ok(text.includes(r.quantity.toFixed()));assert.ok(text.includes(format(r.totalNet)));assert.ok(!/NaN|Infinity/.test(text));});
test('localStorage shape validator rejects corrupted data',()=>{assert.equal(isPlan(DEFAULT_PLAN),true);assert.equal(isPlan(null),false);assert.equal(isPlan({...DEFAULT_PLAN,targets:[]}),false);assert.equal(isPlan({...DEFAULT_PLAN,entry:12}),false);});
test('risk properties hold across budgets, stops, directions and fees',()=>{for(const direction of ['long','short'] as const){for(const risk of ['0.25','0.5','1','2']){for(const fee of ['0','0.04','0.1','1']){const p=plan({direction,risk,openFee:fee,closeFee:fee,stop:direction==='long'?'99600':'100800'}),r=result(p);assert.ok(r.loss.lte(r.budget));assert.ok(r.recommended.gte(r.quantity));assert.ok(r.totalNet.eq(r.targets[0].batchNet.plus(r.targets[1].batchNet)));}}}});

test('100x margin from direct maximum loss matches independent zero-cost examples',()=>{
 const p=plan({riskMode:'amount',maxLoss:'100',entry:'100000',stop:'99000',leverage:'100',openFee:'0',closeFee:'0',slippage:'0',funding:'0'}),a=result(p),b=result({...p,stop:'99500'});
 assert.ok(a.budget.eq(100));assert.ok(a.margin.eq(100));assert.ok(a.quantity.eq('.1'));
 assert.ok(b.margin.eq(200));assert.ok(b.quantity.eq('.2'));assert.ok(a.loss.eq(100));assert.ok(b.loss.eq(100));
 const c=result({...p,leverage:'50'});assert.ok(c.quantity.eq(a.quantity));assert.ok(c.margin.eq(200));
});
test('amount mode includes costs, ignores inactive percentages and does not depend on equity for sizing',()=>{
 const p=plan({riskMode:'amount',maxLoss:'100',leverage:'100',risk:'',maxRisk:''}),a=result(p),b=result({...p,equity:'10000'});
 assert.ok(a.loss.lte(100));assert.ok(a.quantity.eq(b.quantity));assert.ok(a.margin.eq(b.margin));assert.ok(a.margin.lt(result({...p,openFee:'0',closeFee:'0',slippage:'0'}).margin));
 for(const maxLoss of ['','0','-1','abc','Infinity','5001'])assert.equal(calculate({...p,maxLoss}).ok,false);
 assert.ok(a.warnings.some(w=>w.includes('强平')));
});
test('old preferences and saved plans migrate without changing their loss budget or leverage',()=>{
 const {riskMode,maxLoss,...old}=plan();void riskMode;void maxLoss;
 const migrated=parsePlan(old);assert.ok(migrated);assert.equal(migrated.riskMode,'amount');assert.equal(migrated.maxLoss,'25');assert.equal(migrated.leverage,'5');assert.ok(result(migrated).quantity.eq(result(plan()).quantity));assert.equal(parsePlan({...old,equity:'bad'}),null);
});

test('inverse stop calculation: 100 USDT budget, 100x, fixed margin determines long and short stop',()=>{
 const p=plan({solveMode:'stop',marginInput:'100',riskMode:'amount',maxLoss:'100',entry:'100000',stop:'',leverage:'100',openFee:'0',closeFee:'0',slippage:'0',funding:'0'});
 const long=result(p),short=result({...p,direction:'short'});
 assert.ok(long.stop.eq(99000));assert.ok(short.stop.eq(101000));assert.ok(long.margin.eq(100));assert.ok(short.margin.eq(100));assert.ok(long.loss.eq(100));assert.ok(short.loss.eq(100));
 const rounded=result({...p,marginInput:'123.456789'});assert.ok(rounded.recommended.gt(rounded.quantity));assert.ok(rounded.margin.lte('123.456789'));
 const larger=result({...p,marginInput:'200'});assert.ok(larger.stop.eq(99500));assert.ok(larger.margin.eq(200));assert.ok(larger.loss.eq(100));
 assert.ok(planText(p,long).includes('止损价格：99000.00'));
});
test('inverse stop includes costs and rounds toward entry to stay within risk budget',()=>{
 for(const direction of ['long','short'] as const){
  const p=plan({solveMode:'stop',marginInput:'123.45',riskMode:'amount',maxLoss:'100',entry:'100000',stop:'',leverage:'100',direction,priceStep:'0.1'}),r=result(p);
  assert.ok(r.loss.lte(100));assert.ok(r.margin.lte('123.45'));assert.ok(r.stop.mod('.1').eq(0));
  const next=r.stop.plus(direction==='long'?'-.1':'.1');assert.ok(netAtPrice(p,r,next).neg().gt(100));
  assert.ok(netAtPrice(p,r,r.stop).neg().eq(r.loss));
 }
});
test('inverse mode rejects missing margin, unaffordable costs, invalid stops and insufficient precision',()=>{
 const p=plan({solveMode:'stop',riskMode:'amount',maxLoss:'100',entry:'100000',leverage:'100'});
 for(const marginInput of ['','0','-1','abc','Infinity','0.0000000001'])assert.equal(calculate({...p,marginInput}).ok,false);
 assert.equal(calculate({...p,marginInput:'100',maxLoss:'.001'}).ok,false);
 assert.equal(calculate({...p,marginInput:'100',priceStep:'.001',priceDecimals:'2'}).ok,false);
 assert.equal(calculate({...p,marginInput:'1',maxLoss:'200'}).ok,false);
});
test('pre-inverse saved plans migrate into margin mode without altering risk amount',()=>{
 const {solveMode,marginInput,...old}=plan({riskMode:'amount',maxLoss:'77'});void solveMode;void marginInput;
 const migrated=parsePlan(old);assert.ok(migrated);assert.equal(migrated.solveMode,'margin');assert.equal(migrated.maxLoss,'77');assert.ok(result(migrated).budget.eq(77));
});
