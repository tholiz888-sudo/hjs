import { format, type Result } from './calculations';
import { symbolOf, type Plan } from './types';
/** Simple view solves only the stop price. Professional TP inputs remain untouched. */
export function simplePlan(p:Plan):Plan{return {...p,solveMode:'stop',riskMode:'amount'};}
export function simpleText(p:Plan,r:Result):string {
 return [`交易标的：${symbolOf(p)}`,`方向：${p.direction==='long'?'做多':'做空'}`,`开仓价格：${p.entry} USDT`,`杠杆：${p.leverage}x`,`投入保证金：${p.marginInput} USDT`,`数量取整后保证金：${format(r.margin)} USDT`,`最多亏损预算：${p.maxLoss} USDT`,`计划止损价格：${r.stop.toFixed(Number(p.priceDecimals))} USDT`,`预计止损净亏损：${format(r.loss)} USDT`,`取整仓位数量：${r.quantity.toFixed()}`,`费用估算：开仓 ${p.openFee}%，平仓 ${p.closeFee}%，往返滑点 ${p.slippage}%，持仓期资金费成本 ${p.funding}%`,`滑点与资金费按入场名义价值各计一次；价格按配置步长向入场价方向取整。`,`止损价不是强平价，实际亏损不保证封顶；交易所规则需另行核对。`,...r.warnings].join('\n');
}
