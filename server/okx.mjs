import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {MarketError} from './market-error.mjs';
const exec=promisify(execFile);
const intervals={'3m':180000,'5m':300000,'15m':900000};
export async function okxPublic(path,{signal}={}){
 const url=new URL(path,'https://www.okx.com');
 if(url.hostname!=='www.okx.com'||!url.pathname.startsWith('/api/v5/'))throw new MarketError('不支持的OKX数据地址','INVALID_ENDPOINT');
 let result;try{result=await exec('curl',['--silent','--show-error','--max-time','15','--write-out','\n%{http_code}',url.href],{maxBuffer:8*1024*1024,signal})}catch{if(signal?.aborted)throw new MarketError('行情采集已停止','ABORTED');throw new MarketError('无法连接OKX：网络、DNS或TLS请求失败。','NETWORK_ERROR')}
 const split=result.stdout.lastIndexOf('\n'),status=Number(result.stdout.slice(split+1));
 if(status===451||status===403)throw new MarketError(`OKX拒绝当前部署地区或网络访问（HTTP ${status}）`,'REGION_RESTRICTED',3600000);
 let json;try{json=JSON.parse(result.stdout.slice(0,split))}catch{throw new MarketError(`OKX响应格式异常（HTTP ${status}）`,'INVALID_RESPONSE')}
 if(status===429||String(json.code)==='50011')throw new MarketError('OKX限流，后台将延迟重试。','RATE_LIMITED',300000);
 if(status<200||status>=300||String(json.code)!=='0'||!Array.isArray(json.data))throw new MarketError(`OKX请求失败（HTTP ${status}，代码${String(json.code||'未知')}）`,'UPSTREAM_ERROR');
 return json.data;
}
const symbolOf=id=>id.replace(/-USDT-SWAP$/,'USDT');
const instrumentOf=symbol=>{if(!/^[A-Z0-9]+USDT$/.test(symbol))throw new MarketError('不支持的合约代码','INVALID_SYMBOL');return symbol.replace(/USDT$/,'-USDT-SWAP')};
// Internal normalized schema is shared by providers; these legacy-style paths
// are translated here, never forwarded to Binance when OKX is selected.
export function createOkxRequest({get=okxPublic}={}){return async(path,options={})=>{
 const url=new URL(path,'https://internal.invalid');
 if(url.pathname==='/fapi/v1/exchangeInfo'){const rows=await get('/api/v5/public/instruments?instType=SWAP',options);return{symbols:rows.filter(r=>r.instId?.endsWith('-USDT-SWAP')&&r.settleCcy==='USDT'&&r.state==='live').map(r=>({symbol:symbolOf(r.instId),quoteAsset:'USDT',contractType:'PERPETUAL',status:'TRADING'}))}}
 if(url.pathname==='/fapi/v1/ticker/24hr'){const rows=await get('/api/v5/market/tickers?instType=SWAP',options);return rows.filter(r=>r.instId?.endsWith('-USDT-SWAP')).map(r=>({symbol:symbolOf(r.instId),lastPrice:r.last,priceChangePercent:Number(r.open24h)>0?String((Number(r.last)/Number(r.open24h)-1)*100):'0',quoteVolume:String(Number(r.volCcy24h)*Number(r.last)),quoteVolumeEstimated:true}))}
 if(url.pathname==='/fapi/v1/klines'){
  const symbol=url.searchParams.get('symbol')||'',instId=instrumentOf(symbol),bar=url.searchParams.get('interval'),ms=intervals[bar],target=Math.min(700,Math.max(1,Number(url.searchParams.get('limit'))||700)),start=Number(url.searchParams.get('startTime')||0);
  if(!ms)throw new MarketError('不支持的K线周期','INVALID_INTERVAL');
  const found=new Map();let after=null;
  for(let page=0;page<10&&found.size<target;page++){
   const query=new URLSearchParams({instId,bar,limit:String(Math.min(300,target-found.size+1))});if(after!=null)query.set('after',String(after));
   const rows=await get('/api/v5/market/candles?'+query,options);if(!rows.length)break;
   let oldest=Infinity;for(const b of rows){const timestamp=Number(b[0]);if(!Number.isFinite(timestamp))throw new MarketError('OKX K线时间无效','INVALID_CANDLES');oldest=Math.min(oldest,timestamp);if(String(b[8])!=='1'||timestamp<start)continue;
    // volCcy is base-asset volume; volCcyQuote is actual USDT turnover.
    // Do not use contract counts (vol) as USDT turnover.
    const record=[timestamp,b[1],b[2],b[3],b[4],b[6],timestamp+ms-1,b[7]];
    found.set(timestamp,record);
   }
   if(oldest<start||after!=null&&oldest>=after)break;after=oldest;
  }
  return [...found.values()].sort((a,b)=>a[0]-b[0]).slice(-target);
 }
 if(url.pathname.startsWith('/futures/data/'))throw new MarketError('OKX账户多空比数据尚未接入','DATASET_UNAVAILABLE');
 throw new MarketError('不支持的OKX数据请求','INVALID_ENDPOINT');
}}
