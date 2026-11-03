const decode=value=>typeof value==='string'?JSON.parse(value):value;
export function settlementFromMarket(m,{slug,conditionId,now=Date.now()}){
  const pending=(code,reason)=>({status:'pending',code,reason,source:'Gamma',observedAt:new Date(now).toISOString()});
  if(!m||m.slug!==slug)return pending('NOT_FOUND','没有找到与slug一致的市场');
  if(conditionId&&m.conditionId!==conditionId)return pending('IDENTITY_MISMATCH','市场资金合约ID不匹配，未记结算');
  const end=Date.parse(m.endDate);if(!Number.isFinite(end)||end>now)return pending('NOT_ENDED','市场尚未到期或结束时间无效');
  if(m.closed!==true)return pending('NOT_CLOSED','平台尚未标记市场关闭');
  // Official ts-sdk Gamma schema distinguishes v2 resolutionStatus from legacy UMA lifecycle.
  const version=m.version||'v1',field=version==='v2'?'resolutionStatus':'umaResolutionStatus';
  if(!['v1','v2'].includes(version))return pending('UNKNOWN_PROTOCOL','未知市场协议，不猜测结算状态');
  if(m[field]!=='resolved')return pending('NO_FINAL_STATUS',`平台${field}尚未明确为resolved`);
  let outcomes,prices;try{outcomes=decode(m.outcomes);prices=decode(m.outcomePrices);}catch{return pending('INVALID_PAYLOAD','平台结果字段无法解析');}
  if(!Array.isArray(outcomes)||outcomes.length!==2||!Array.isArray(prices)||prices.length!==2||new Set(outcomes.map(x=>String(x).toLowerCase())).size!==2||!outcomes.every(x=>['up','down'].includes(String(x).toLowerCase())))return pending('NOT_BINARY','不是可确认的Up/Down二元结果');
  const values=prices.map(Number),index=values.findIndex(x=>x===1);
  if(index<0||values[1-index]!==0)return pending('NO_FINAL_PAYOUT','最终兑付尚未明确为1/0，不用接近1的价格猜赢家');
  return {status:'resolved',winner:outcomes[index].toLowerCase(),source:'Gamma',observedAt:new Date(now).toISOString(),evidence:{slug,conditionId:m.conditionId||null,version,field,value:m[field],closed:true,endDate:m.endDate,outcomes,prices:values}};
}
export async function querySettlement(remote,slug,now=Date.now(),conditionId){
  const rows=await remote('https://gamma-api.polymarket.com/markets?slug='+encodeURIComponent(slug));
  if(!Array.isArray(rows))throw Error('Gamma结算响应不是市场数组');
  return settlementFromMarket(rows.find(m=>m.slug===slug),{slug,conditionId,now});
}
