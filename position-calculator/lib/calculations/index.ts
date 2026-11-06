import Decimal from 'decimal.js';
import type { Plan } from '../types';
export const D = Decimal.clone({ precision: 120, rounding: Decimal.ROUND_HALF_UP });
export type Num = Decimal;
export type Costs = { price: Num; opening: Num; closing: Num; slippage: Num; funding: Num; total: Num };
export type TargetResult = { price: Num; share: Num; quantity: Num; gross: Num; net: Num; roi: Num; grossR: Num; netR: Num; batchNet: Num };
export type Result = { stop: Num; budget: Num; distance: Num; distancePercent: Num; quantity: Num; recommended: Num; notional: Num; margin: Num; loss: Num; costs: Costs; breakEven: Num; targets: TargetResult[]; totalNet: Num; weightedGrossR: Num; weightedNetR: Num; partialStop: Num; warnings: string[]; feasible: boolean };
export type Calculation = { ok: true; result: Result } | { ok: false; errors: string[] };
const labels: Record<string,string> = {equity:'账户权益',risk:'风险比例',maxRisk:'风险上限',entry:'入场价格',stop:'止损价格',leverage:'杠杆倍数',openFee:'开仓费率',closeFee:'平仓费率',slippage:'滑点比例',funding:'资金费成本',priceStep:'价格步长',quantityStep:'数量步长',minQuantity:'最小数量',priceDecimals:'价格显示精度'};
const numeric = (v: unknown): v is string => typeof v === 'string' && v.length <= 80 && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(v);
/** Costs are conservative nonnegative estimates. Slippage is charged once on entry notional
 * for the entire round trip; funding is a total holding-period cost on entry notional.
 * Exit fee uses the hypothetical exit price. No fee discounts or funding credits assumed. */
export function calculate(p: Plan, { includeTargets = true }: { includeTargets?: boolean } = {}): Calculation {
  const errors: string[] = [];
  if(!['amount','percent'].includes(p.riskMode)) return {ok:false,errors:['请选择有效的风险输入方式']};
  if(!['margin','stop'].includes(p.solveMode)) return {ok:false,errors:['请选择计算方式']};
  const fields = Object.keys(labels).filter(k=>(p.riskMode==='percent'||!['risk','maxRisk'].includes(k))&&(p.solveMode!=='stop'||k!=='stop')) as (keyof Plan)[];
  for (const key of fields) if (!numeric(p[key])) errors.push(`${labels[key]}请输入有效数字`);
  if (errors.length) return {ok:false,errors};
  const n = Object.fromEntries(fields.map(k => [k,new D(p[k] as string)])) as Record<string,Num>;
  for(const k of ['equity',...(p.riskMode==='percent'?['risk','maxRisk']:[]),'entry',...(p.solveMode==='margin'?['stop']:[]),'leverage','priceStep','quantityStep','minQuantity']) if(n[k].lte(0)) errors.push(`${labels[k]}必须大于 0`);
  if(p.riskMode==='amount'&&(!numeric(p.maxLoss)||new D(p.maxLoss).lte(0))) errors.push('计划最多亏损请输入大于 0 的有效金额');
  if(p.riskMode==='percent'&&(n.maxRisk.gt(100)||n.risk.gt(n.maxRisk))) errors.push('风险比例不能超过所设上限，上限最大为 100%');
  if(n.leverage.lt(1)||n.leverage.gt(200)) errors.push('杠杆须在 1–200 倍之间');
  if(!n.priceDecimals.isInteger()||n.priceDecimals.lt(0)||n.priceDecimals.gt(12)) errors.push('价格显示精度须为 0–12 位整数');
  for(const k of ['openFee','closeFee','slippage','funding']) if(n[k].gt(10)) errors.push(`${labels[k]}须在 0–10% 之间`);
  if(!['long','short'].includes(p.direction)) errors.push('交易方向无效');
  if(!['BTCUSDT','ETHUSDT','CUSTOM'].includes(p.symbol) || (p.symbol==='CUSTOM'&&!/^[A-Za-z0-9._/-]{2,30}$/.test(p.customSymbol))) errors.push('请输入有效的交易标的');
  if(p.solveMode==='stop'&&(!numeric(p.marginInput)||new D(p.marginInput).lte(0))) errors.push('投入保证金请输入大于 0 的有效金额');
  if(errors.length)return {ok:false,errors};
  const budget=p.riskMode==='amount'?new D(p.maxLoss):n.equity.mul(n.risk).div(100);
  if(budget.gt(n.equity)) return {ok:false,errors:['计划最多亏损不能超过账户权益']};
  let fixedQuantity: Num | null=null;
  const sign = p.direction === 'long' ? new D(1) : new D(-1);
  if(p.solveMode==='stop') {
    if(n.priceStep.decimalPlaces()>n.priceDecimals.toNumber())return {ok:false,errors:['反算止损需要足够价格显示精度，请提高小数位以展示价格步长']};
    fixedQuantity=new D(p.marginInput).mul(n.leverage).divToInt(n.entry.mul(n.quantityStep)).mul(n.quantityStep);
    if(fixedQuantity.lte(0)||fixedQuantity.lt(n.minQuantity))return {ok:false,errors:['投入保证金对应的数量低于最小数量，无法反算止损价']};
    const allEntryRates=n.openFee.plus(n.slippage).plus(n.funding).div(100);
    const rawStop=n.entry.mul(sign.plus(allEntryRates)).minus(budget.div(fixedQuantity)).div(sign.minus(n.closeFee.div(100)));
    if(rawStop.lte(0))return {ok:false,errors:['此预算对应的止损价不大于 0，请调整亏损金额或保证金']};
    n.stop=rawStop.div(n.priceStep).toDecimalPlaces(0,p.direction==='long'?D.ROUND_CEIL:D.ROUND_FLOOR).mul(n.priceStep);
    if(n.entry.minus(n.stop).mul(sign).lte(0))return {ok:false,errors:['费用已占满亏损预算，或价格步长下没有有效止损空间，请调整保证金、预算或费用']};
  }
  const distance = n.entry.minus(n.stop).mul(sign);
  if(distance.lte(0)) errors.push(p.direction==='long'?'做多止损必须低于入场价':'做空止损必须高于入场价');
  const targetValues: Num[] = [], shares: Num[] = [];
  if(includeTargets&&(!Array.isArray(p.targets)||p.targets.length!==2)) return {ok:false,errors:[...errors,'需要两个止盈目标']};
  (includeTargets?p.targets:[]).forEach((t,i)=>{
    if(!t||!['r','price'].includes(t.mode)||!numeric(t.value)||!numeric(t.share)){errors.push(`TP${i+1} 的目标或比例无效`);return;}
    const price = t.mode==='r' ? n.entry.plus(distance.mul(t.value).mul(sign)) : new D(t.value);
    if(new D(t.value).lte(0)||price.lte(0)||price.minus(n.entry).mul(sign).lte(0)) errors.push(`TP${i+1} 必须是大于零且方向正确的止盈价`);
    const share = new D(t.share);
    if(share.lt(0)||share.gt(100)) errors.push(`TP${i+1} 平仓比例须在 0–100% 之间`);
    targetValues.push(price);shares.push(share.div(100));
  });
  if(shares.length===2&&!shares[0].plus(shares[1]).eq(1)) errors.push('分批平仓比例总和必须为 100%');
  if(targetValues.length===2&&targetValues[1].minus(targetValues[0]).mul(sign).lte(0)) errors.push('TP2 必须比 TP1 距入场价更远');
  if(errors.length) return {ok:false,errors};
  const openRate = n.openFee.div(100), closeRate=n.closeFee.div(100), slipRate=n.slippage.div(100), fundRate=n.funding.div(100);
  const unitLoss=distance.plus(n.entry.mul(openRate.plus(slipRate).plus(fundRate))).plus(n.stop.mul(closeRate));
  const recommended=p.solveMode==='stop'?new D(p.marginInput).mul(n.leverage).div(n.entry):budget.div(unitLoss);
  // Floor the ratio directly, avoiding double rounding at quantity-step boundaries.
  const quantity=fixedQuantity??budget.divToInt(unitLoss.mul(n.quantityStep)).mul(n.quantityStep);
  const notional=quantity.mul(n.entry), margin=notional.div(n.leverage);
  const priceLoss=quantity.mul(distance), opening=notional.mul(openRate), closing=quantity.mul(n.stop).mul(closeRate), slippage=notional.mul(slipRate), funding=notional.mul(fundRate);
  const costs={price:priceLoss,opening,closing,slippage,funding,total:opening.plus(closing).plus(slippage).plus(funding)};
  const loss=priceLoss.plus(costs.total);
  const netAt=(exit:Num)=>quantity.mul(exit.minus(n.entry).mul(sign).minus(n.entry.mul(openRate.plus(slipRate).plus(fundRate))).minus(exit.mul(closeRate)));
  const breakEven=n.entry.mul(sign.plus(openRate).plus(slipRate).plus(fundRate)).div(sign.minus(closeRate));
  const targets=targetValues.map((price,i)=>{
    const gross=quantity.mul(price.minus(n.entry)).mul(sign), net=netAt(price);
    return {price,share:shares[i],quantity:quantity.mul(shares[i]),gross,net,roi:margin.eq(0)?new D(0):net.div(margin).mul(100),grossR:price.minus(n.entry).mul(sign).div(distance),netR:loss.eq(0)?new D(0):net.div(loss),batchNet:net.mul(shares[i])};
  });
  const totalNet=targets.reduce((s,t)=>s.plus(t.batchNet),new D(0));
  const weightedGrossR=targets.reduce((s,t)=>s.plus(t.grossR.mul(t.share)),new D(0));
  const weightedNetR=loss.eq(0)?new D(0):totalNet.div(loss);
  const partialStop=targets.length===2?targets[0].batchNet.minus(loss.mul(targets[1].share)):new D(0);
  const warnings:string[]=[];
  if(quantity.lt(n.minQuantity)||quantity.eq(0)) warnings.push('取整数量低于配置的最小数量，当前方案不可执行');
  if(margin.plus(opening).gt(n.equity)) warnings.push('预估保证金及开仓费超过账户权益，当前方案不可执行');
  if(n.leverage.gte(50)) warnings.push('高杠杆可能在计划止损前触发强平；缺少交易所保证金参数，无法确认止损前可用空间。实际亏损不保证封顶于预算');
  if(loss.gt(budget)) warnings.push('止损净亏损超过风险预算');
  const tick = new D(10).pow(n.priceDecimals.neg());
  if(n.priceStep.lt(tick)) warnings.push('价格显示精度不足以展示价格步长，请提高精度');
  if(!n.entry.mod(n.priceStep).eq(0)||!n.stop.mod(n.priceStep).eq(0)||targetValues.some(t=>!t.mod(n.priceStep).eq(0))) warnings.push('部分价格不符合配置的价格步长，请调整后再使用');
  if(targets.some(t=>!t.quantity.mod(n.quantityStep).eq(0))) warnings.push('分批数量未全部对齐数量步长，需按实际交易规则调整分批方案');
  if(targets.some(t=>t.quantity.gt(0)&&t.quantity.lt(n.minQuantity))) warnings.push('分批数量低于最小数量，需调整分批方案');
  return {ok:true,result:{stop:n.stop,budget,distance,distancePercent:distance.div(n.entry).mul(100),quantity,recommended,notional,margin,loss,costs,breakEven,targets,totalNet,weightedGrossR,weightedNetR,partialStop,warnings,feasible:warnings.length===0}};
}
export function netAtPrice(p: Plan,r:Result,price: Decimal.Value): Num {
  const exit = new D(price), sign=p.direction==='long'?1:-1;
  return r.quantity.mul(exit.minus(p.entry).mul(sign).minus(new D(p.entry).mul(new D(p.openFee).plus(p.slippage).plus(p.funding)).div(100)).minus(exit.mul(p.closeFee).div(100)));
}
export function format(n: Decimal.Value, digits=2): string {
  const [whole,fraction] = new D(n).toFixed(digits).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')+(fraction === undefined ? '' : '.'+fraction);
}
