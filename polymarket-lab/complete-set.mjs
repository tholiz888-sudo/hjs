const epsilon=1e-7;
export function auditCompleteSet({up,down,netCash}) {
  if(![up,down,netCash].every(Number.isFinite)||up< -epsilon||down< -epsilon)return {valid:false,lowerBoundPnl:null,message:'份额或现金流无效，不能宣称组合保本'};
  up=Math.max(0,up);down=Math.max(0,down);
  const pairedShares=Math.min(up,down),residualShares=Math.abs(up-down),lowerBoundPnl=netCash+pairedShares;
  const residualSide=residualShares<=epsilon?null:up>down?'up':'down';
  return {valid:true,pairedShares,residualShares,residualSide,lowerBoundPnl,covered:lowerBoundPnl>=-epsilon,residualCostCovered:residualSide!==null&&lowerBoundPnl>=-epsilon,additionalCashAtRisk:Math.max(0,-lowerBoundPnl),message:lowerBoundPnl>=-epsilon?'在互补合约正常结算、现金流完整的假设下，成本已由组合兑付下限覆盖':'组合仍可能整体亏损；配对部分便宜不代表残余仓位免费'};
}
export function auditPortfolio({cash,capital,positions}) {
  if(![cash,capital].every(Number.isFinite)||!Array.isArray(positions))return {valid:false,lowerBoundPnl:null};
  let payout=0;for(const p of positions){if(p.settled)continue;const a=auditCompleteSet({up:p.up,down:p.down,netCash:0});if(!a.valid)return {valid:false,lowerBoundPnl:null};payout+=a.pairedShares;}
  return {valid:true,minimumPayout:payout,lowerBoundEquity:cash+payout,lowerBoundPnl:cash+payout-capital,assumption:'各市场分别计算互补份额；假设正常结算、没有遗漏费用或资金流。不是按市价计算的当前净利润，也不是合约风险担保。'};
}
