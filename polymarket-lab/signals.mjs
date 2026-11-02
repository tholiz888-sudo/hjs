import {fisher} from './engine.mjs';
export function validateCandles(candles) {
  if(!Array.isArray(candles)||candles.length>20000)throw Error('BTC蜡烛数量超限');
  let prior=-Infinity;
  return candles.map(c=>{if(!Number.isFinite(c.time)||c.time<=prior||!Number.isFinite(c.close)||c.close<=0)throw Error('BTC蜡烛需按收盘时间严格升序，价格须为正数');prior=c.time;return c;});
}
export function signals(candles,{period=10,threshold=1.5}={}) {
  validateCandles(candles);
  if(!Number.isFinite(threshold)||threshold<=0||threshold>10)throw Error('Fisher阈值无效');
  const values=fisher(candles.map(c=>c.close),period);
  return candles.map((c,i)=>{const cur=values[i],prev=values[i-1];let side=null;
    const contiguous=i>=period+1&&candles.slice(i-period-1,i+1).every((v,j,a)=>j===0||v.time-a[j-1].time===60000);
    if(cur&&prev&&contiguous){if(prev.value<=prev.trigger&&cur.value>cur.trigger&&prev.value<=-threshold)side='up';if(prev.value>=prev.trigger&&cur.value<cur.trigger&&prev.value>=threshold)side='down';}
    return {time:c.time,close:c.close,value:cur?.value??null,trigger:cur?.trigger??null,side};
  });
}
export async function fetchBTC(remote,now=Date.now()) {
  const raw=await remote('https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60');
  if(!Array.isArray(raw))throw Error('BTC行情格式异常');
  const candles=raw.map(r=>({time:(Number(r[0])+60)*1000,close:Number(r[4])})).filter(c=>c.time<=now).sort((a,b)=>a.time-b.time);
  validateCandles(candles);
  if(candles.length<20||now-candles.at(-1).time>180000)throw Error('BTC已收盘分钟行情不足或过期');
  return {source:'Coinbase BTC-USD 1m，非Polymarket结算价格源',candles,latest:signals(candles).at(-1)};
}
