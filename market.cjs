const periods=new Map([[1,'1m'],[5,'5m'],[15,'15m'],[60,'1H'],[1440,'1Dutc']]);
async function historicalCandles({pair,period,start,end},fetcher=fetch){
 if(!/^[A-Z0-9]{2,15}-USDT-SWAP$/.test(pair)||!periods.has(period)||!Number.isFinite(start)||!Number.isFinite(end)||start<1577836800000||end<=start||end>Date.now()+86400000||end-start>86400000*370)throw Error('行情请求参数无效');
 let cursor=end+1,all=[],exhausted=false;
 for(let i=0;i<6;i++){
  const url=new URL('https://www.okx.com/api/v5/market/history-candles');url.search=new URLSearchParams({instId:pair,bar:periods.get(period),after:String(cursor),limit:'300'});
  const r=await fetcher(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('行情服务暂不可访问（HTTP '+r.status+'）');const b=await r.json();if(b.code!=='0'||!Array.isArray(b.data))throw Error('该交易对的历史行情暂不可用');if(!b.data.length){exhausted=true;break}
  const parsed=b.data.map(a=>({pair,time:Number(a[0]),open:Number(a[1]),high:Number(a[2]),low:Number(a[3]),close:Number(a[4]),volume:Number(a[5])}));
  if(parsed.some(c=>!Object.values(c).filter(v=>typeof v==='number').every(Number.isFinite)||c.low<=0||c.high<Math.max(c.open,c.close,c.low)||c.low>Math.min(c.open,c.close)||c.volume<0))throw Error('行情服务返回了无效数据');
  all.push(...parsed);const oldest=Math.min(...parsed.map(c=>c.time));if(oldest>=cursor)throw Error('行情分页未前进');cursor=oldest;if(oldest<=start){exhausted=true;break}
 }
 const seen=new Map();for(const c of all)if(c.time>=start&&c.time<=end)seen.set(c.time,c);const candles=[...seen.values()].sort((a,b)=>a.time-b.time);
 return {candles,source:'OKX 历史行情',partial:!exhausted,start,end};
}
module.exports={historicalCandles};

// The user's existing public deployment can relay market reads for local machines.
// Only OHLC parameters are forwarded, never cookies or account credentials.
async function candlesWithFallback(params,{allowRelay=false,fetcher=fetch}={}){
 try{return await historicalCandles(params,fetcher)}catch(directError){
  if(!allowRelay||/参数|无效数据|分页|交易对的历史行情/.test(directError.message))throw directError;
  const url=new URL('https://hjs-fqyj.onrender.com/api/candles');url.search=new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]));
  try{
   const response=await fetcher(url,{signal:AbortSignal.timeout(65000),headers:{'X-HJS-Market-Relay':'1'},redirect:'error'});
   if(!response.ok)throw Error('在线备用站点返回 HTTP '+response.status);
   const result=await response.json();if(!Array.isArray(result.candles)||result.candles.length>1800)throw Error('备用行情数据格式无效');
   for(const c of result.candles)if(c.pair!==params.pair||![c.time,c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite)||c.time<params.start||c.time>params.end||c.low<=0||c.high<Math.max(c.open,c.low,c.close)||c.low>Math.min(c.open,c.close)||c.volume<0)throw Error('备用行情数据校验失败');
   return {...result,source:'OKX 历史行情（经在线站点）'};
  }catch(relayError){throw Error('本地无法连接行情服务，在线备用通道也未成功。请确认浏览器能打开 hjs-fqyj.onrender.com，然后重试；或导入行情 CSV。')}
 }
}
module.exports.candlesWithFallback=candlesWithFallback;
