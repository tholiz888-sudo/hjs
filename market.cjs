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
