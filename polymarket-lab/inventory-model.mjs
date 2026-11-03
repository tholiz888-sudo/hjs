import {validateCandles} from './signals.mjs';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function cdf(x){const t=1/(1+.2316419*Math.abs(x)),d=.3989422804014327*Math.exp(-x*x/2);const tail=d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?1-tail:tail;}
export function inventoryModel(snapshot,settings={}){
  const u=snapshot.underlying,now=Date.parse(snapshot.observedAt),end=Date.parse(snapshot.end);
  if(!u)return {ready:false,reason:'缺少BTC现货、参考价及波动率输入'};
  if(!Number.isFinite(u.spot)||u.spot<=0||!Number.isFinite(u.spotTime)||u.spotTime>now||now-u.spotTime>15000)return {ready:false,reason:'BTC现货过期或时间异常'};
  if(!Number.isFinite(u.reference)||u.reference<=0||!Number.isFinite(u.referenceTime)||u.referenceTime>now)return {ready:false,reason:'参考价不可用，禁止猜测结算基准'};
  if(Number.isFinite(snapshot.start)&&u.referenceTime!==snapshot.start)return {ready:false,reason:'参考价时间与市场起点不匹配'};
  if(!['official','coinbase-minute-proxy'].includes(u.referenceSource))return {ready:false,reason:'参考价来源未识别'};
  const candles=validateCandles(u.candles||[]).filter(c=>c.time<=now);
  if(candles.length<21||now-candles.at(-1).time>180000)return {ready:false,reason:'用于波动率的已收盘分钟行情不足或过期'};
  const recent=candles.slice(-21);if(recent.some((c,i)=>i&&c.time-recent[i-1].time!==60000))return {ready:false,reason:'分钟行情有缺口'};
  const returns=recent.slice(1).map((c,i)=>Math.log(c.close/recent[i].close)),mean=returns.reduce((a,b)=>a+b,0)/returns.length;
  const volatility=Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/(returns.length-1));
  if(!Number.isFinite(volatility)||volatility<1e-6||end<=now)return {ready:false,reason:'波动率不足以建模或市场已结束'};
  const remainingMinutes=(end-now)/60000,momentum=Math.log(recent.at(-1).close/recent.at(-6).close)/5;
  const displacement=Math.log(u.spot/u.reference),drift=clamp(momentum,-volatility,volatility)*.15;
  const z=(displacement+drift*remainingMinutes)/(volatility*Math.sqrt(Math.max(remainingMinutes,.05)));
  // This is an uncalibrated baseline, not a recovered bosona probability model.
  const probabilityUp=clamp(cdf(z),.02,.98),threshold=settings.entryEdge??.06;
  return {ready:true,probabilityUp,probabilityDown:1-probabilityUp,volatilityPerMinute:volatility,momentumPerMinute:momentum,displacement,remainingSeconds:(end-now)/1000,entryEdge:threshold,referenceSource:u.referenceSource,referenceVerified:u.referenceSource==='official',spot:u.spot,reference:u.reference,spotTime:u.spotTime,reason:'未校准的参考价偏离＋动量＋波动率候选模型；盘口仅用于报价与深度，尚未接入真实成交流'};
}
export async function fetchSpot(remote,now=Date.now()){
 const r=await remote('https://api.exchange.coinbase.com/products/BTC-USD/ticker');const time=Date.parse(r.time),price=Number(r.price);
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(time)||time>now+1000||now-time>15000)throw Error('BTC ticker过期或格式异常');
 return {price,time,source:'Coinbase BTC-USD ticker'};
}
export function currentBTCSlugs(now){return [300,900].map(seconds=>`btc-updown-${seconds===300?'5m':'15m'}-${Math.floor(now/1000/seconds)*seconds}`);}
