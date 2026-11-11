import { format, type Result } from './calculations';
import { symbolOf, type Plan } from './types';
/** Both simple modes exclude professional TP inputs without rewriting them. */
export type SimpleMode='stop'|'risk';
export function simplePlan(p:Plan,mode:SimpleMode='stop'):Plan{return mode==='risk'?{...p,solveMode:'margin',riskMode:'percent'}:{...p,solveMode:'stop',riskMode:'amount'};}
export function simpleText(p:Plan,r:Result):string {
 if(p.solveMode==='margin'&&p.riskMode==='percent')return [`交易标的：${symbolOf(p)}`,`方向：${p.direction==='long'?'做多':'做空'}`,`账户本金：${p.equity} USDT`,`单笔风险比例：${p.risk}%`,`计划风险预算：${r.budget.toFixed()} USDT`,`开仓价格：${p.entry} USDT`,`止损价格：${p.stop} USDT`,`止损距离：${format(r.distancePercent,3)}%`,`建议名义仓位：${r.notional.toFixed()} USDT`,`杠杆：${p.leverage}x`,`建议投入保证金：${r.margin.toFixed()} USDT`,`取整下单数量：${r.quantity.toFixed()}`,`预计止损亏损：${r.loss.toFixed()} USDT`,p.costMode==='price'?'未计手续费、滑点及资金费，实际净亏损可能更高。':'包含所设手续费、滑点与资金费估算。','本金风险比例与价格止损距离不同；保证金＝名义仓位÷杠杆。止损不保证按计划价格成交，实际亏损不保证封顶。',...r.warnings].join('\n');
 return [`交易标的：${symbolOf(p)}`,`方向：${p.direction==='long'?'做多':'做空'}`,`开仓价格：${p.entry} USDT`,`杠杆：${p.leverage}x`,`投入保证金：${p.marginInput} USDT`,`数量取整后保证金：${format(r.margin)} USDT`,`最多亏损预算：${p.maxLoss} USDT`,`计划止损价格：${r.stop.toFixed(Number(p.priceDecimals))} USDT`,`预计止损${p.costMode==='price'?'价格亏损':'净亏损'}：${format(r.loss)} USDT`,p.costMode==='price'?'计算口径：未计手续费、滑点及资金费，实际净亏损可能更高。':'计算口径：包含所设费用估算。',`取整仓位数量：${r.quantity.toFixed()}`,`费用设置（${p.costMode==='price'?'当前未计入':'已计入'}）：开仓 ${p.openFee}%，平仓 ${p.closeFee}%，往返滑点 ${p.slippage}%，持仓期资金费成本 ${p.funding}%`,`滑点与资金费按入场名义价值各计一次；价格按配置步长向入场价方向取整。`,`止损价不是强平价，实际亏损不保证封顶；交易所规则需另行核对。`,...r.warnings].join('\n');
}
