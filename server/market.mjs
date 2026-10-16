import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {analyseBars,defaultConfig,ema} from './indicators.mjs';
import {MarketError} from './market-error.mjs';
import {createOkxRequest} from './okx.mjs';
export {MarketError} from './market-error.mjs';
const exec=promisify(execFile);
export async function binance(path,{signal}={}){
 const url=new URL(path,'https://fapi.binance.com');
 if(url.hostname!=='fapi.binance.com'||!['/fapi/v1/','/futures/data/'].some(p=>url.pathname.startsWith(p)))throw new MarketError('不支持的数据地址','INVALID_ENDPOINT');
 let result;try{result=await exec('curl',['--silent','--show-error','--max-time','15','--write-out','\n%{http_code}',url.href],{maxBuffer:8*1024*1024,signal})}catch(e){if(signal?.aborted)throw new MarketError('行情采集已停止','ABORTED');throw new MarketError('无法连接Binance：网络、DNS或TLS请求失败；未使用模拟数据。','NETWORK_ERROR')}
 const split=result.stdout.lastIndexOf('\n'),status=Number(result.stdout.slice(split+1));let d;try{d=JSON.parse(result.stdout.slice(0,split))}catch{throw new MarketError(`Binance响应格式异常（HTTP ${status}）`,'INVALID_RESPONSE')}
 if(status===451)throw new MarketError('Binance拒绝当前部署地区访问（HTTP 451），需要在交易所允许的运行地区接入。','REGION_RESTRICTED',3600000);
 if(status===429||status===418)throw new MarketError(`Binance限流（HTTP ${status}），后台将延迟重试。`,'RATE_LIMITED',status===418?1800000:300000);
 if(status<200||status>=300||d?.code<0)throw new MarketError(`Binance请求失败（HTTP ${status}）`,'UPSTREAM_ERROR');
 return d;
}
const timeframeMs={'3m':180000,'5m':300000,'15m':900000};
const blank=()=>({signals:[],charts:[],td:[],tickers:[],monitor:[],smartMoney:[]});
export function createMarket({exchange=process.env.MARKET_EXCHANGE||'okx',request,now=Date.now,load=()=>null,save=()=>{},symbolLimit=Number(process.env.MARKET_SYMBOL_LIMIT)||20,intervalMs=Math.max(30000,Number(process.env.MARKET_REFRESH_SECONDS||60)*1000),setTimer=setTimeout,clearTimer=clearTimeout,config={}}={}){
 if(!['binance','okx'].includes(exchange))throw new Error('MARKET_EXCHANGE必须是binance或okx');
 request??=exchange==='okx'?createOkxRequest():binance;const exchangeName=exchange==='okx'?'OKX':'Binance',supportsAccountRatios=exchange==='binance';
 const rules={...defaultConfig,...config};const limit=Math.max(1,Math.min(200,symbolLimit));const staleAfterMs=Math.max(180000,intervalMs*3);let data=blank(),barsCache=new Map(),inflight=null,timer=null,started=false,stopped=false,controller=null,lastAttempt=null,failures=0;
 let state={source:exchange,exchangeName,supportsAccountRatios,volumeRanking:exchange==='okx'?'base-volume-times-last-price':'quote-turnover',ready:false,running:false,automatic:false,updatedAt:null,lastAttemptAt:null,nextRunAt:null,error:null,errorCode:null,symbolCount:0,requestedCount:limit,intervalSeconds:intervalMs/1000,cached:false,partialFailures:[],smartMoneyAvailable:false,config:rules};
 try{const saved=load();if(saved?.version===1&&saved.source===exchange&&saved.updatedAt&&Date.parse(saved.updatedAt)<=now()+60000&&Array.isArray(saved.data?.charts)&&Array.isArray(saved.data?.signals)&&saved.data.charts.length){data={...blank(),...saved.data};barsCache=new Map(Array.isArray(saved.bars)?saved.bars:[]);state={...state,ready:true,updatedAt:saved.updatedAt,symbolCount:data.charts.length,cached:true,smartMoneyAvailable:data.smartMoney.length>0}}}catch{state.cacheError='行情缓存无法恢复，等待重新采集'}
 const status=()=>({...state,running:!!inflight,stale:!state.updatedAt||now()-Date.parse(state.updatedAt)>staleAfterMs,lastCandleAt:data.charts.length?new Date(Math.max(...data.charts.map(c=>c.frames['5m'].at(-1)?.timestamp||0))).toISOString():null});
 async function getBars(symbol,tf,signal){const key=symbol+':'+tf,previous=barsCache.get(key)||[],last=previous.at(-1),ms=timeframeMs[tf];if(last&&now()<last.timestamp+ms*2)return previous;
 const gap=last?Math.ceil((now()-last.timestamp)/ms)+3:700;const incremental=last&&gap<700;const count=incremental?Math.min(700,Math.max(10,gap)):700;
 const suffix=incremental?'&startTime='+Math.max(0,last.timestamp-ms*2):'';
 const raw=await request(`/fapi/v1/klines?symbol=${symbol}&interval=${tf}&limit=${count}${suffix}`,{signal});if(!Array.isArray(raw))throw new MarketError('K线响应格式异常','INVALID_CANDLES');
 const incoming=raw.filter(b=>Number(b[6])<now()).map(b=>({timestamp:Number(b[0]),open:Number(b[1]),high:Number(b[2]),low:Number(b[3]),close:Number(b[4]),volume:Number(b[5]),quoteVolume:Number(b[7])}));
 if(incoming.some(b=>!Object.values(b).every(Number.isFinite)||b.close<=0))throw new MarketError('K线包含无效数值','INVALID_CANDLES');
 const merged=[...new Map([...(incremental?previous:[]),...incoming].map(b=>[b.timestamp,b])).values()].sort((a,b)=>a.timestamp-b.timestamp).slice(-700);
 if(merged.length<210||!merged.at(-1)||now()-(merged.at(-1).timestamp+ms)>ms*2)throw new MarketError('K线数量不足或已过期','STALE_CANDLES');
 for(let i=1;i<merged.length;i++)if(merged[i].timestamp-merged[i-1].timestamp!==ms)throw new MarketError('K线时间序列不连续','CANDLE_GAP');
 barsCache.set(key,merged);return merged;
 }
 function volumeHistory(symbol,bars,price){const averages=ema(bars.map(b=>b.close),21),records=[];for(let i=Math.max(rules.volumeWindow,bars.length-480);i<bars.length;i++){const b=bars[i];if(now()-b.timestamp>86400000)continue;const mean=bars.slice(i-rules.volumeWindow,i).reduce((s,r)=>s+r.volume,0)/rules.volumeWindow,multiplier=mean?b.volume/mean:0;if(multiplier<rules.volumeMultiplier||Math.abs((b.close/b.open-1)*100)<rules.volumeMinChange)continue;records.push({symbol,kind:'volume',bias:b.close>averages[i]?'bullish':'bearish',price,entry:b.close,change:(price/b.close-1)*100,multiplier,quoteVolume:b.quoteVolume,description:'放量',at:new Date(b.timestamp).toISOString(),approximate:true,source:exchange})}return records}
 function monitorRecord(symbol,bars,price){const threshold=Number(process.env.MARKET_MIN_QUOTE_VOLUME)||1000000;const events=bars.filter(b=>now()-b.timestamp<=86400000&&b.quoteVolume>=threshold);if(!events.length)return null;return{symbol:symbol+'/USDT:USDT',count:events.length,change:(price/events[0].close-1)*100,at:new Date(events.at(-1).timestamp).toISOString(),entry:events[0].close,price,peak:Math.max(...events.map(b=>b.quoteVolume)),threshold,timeframe:'5m'}}
 async function scan(){state={...state,running:true,lastAttemptAt:new Date(now()).toISOString(),nextRunAt:null,error:null,errorCode:null};lastAttempt=now();controller=new AbortController();const signal=controller.signal;
 try{const [tickers,info]=await Promise.all([request('/fapi/v1/ticker/24hr',{signal}),request('/fapi/v1/exchangeInfo',{signal})]);if(!Array.isArray(tickers)||!Array.isArray(info?.symbols))throw new MarketError('交易所合约列表格式异常','INVALID_RESPONSE');
 const valid=new Set(info.symbols.filter(s=>s.quoteAsset==='USDT'&&s.contractType==='PERPETUAL'&&s.status==='TRADING').map(s=>s.symbol));
 const selected=tickers.filter(t=>valid.has(t.symbol)&&Number(t.lastPrice)>0&&Number.isFinite(Number(t.quoteVolume))).sort((a,b)=>Number(b.quoteVolume)-Number(a.quoteVolume)).slice(0,limit);if(!selected.length)throw new MarketError('未找到可用USDT永续合约','EMPTY_UNIVERSE');
 const next={...blank(),tickers:selected.map(t=>({symbol:t.symbol.replace(/USDT$/,''),price:Number(t.lastPrice),change:Number(t.priceChangePercent),quoteVolume:Number(t.quoteVolume)}))};let cursor=0;const failed=[];const smartFailed=[];let fatal=null;
 await Promise.all(Array.from({length:Math.min(3,selected.length)},async()=>{while(cursor<selected.length&&!signal.aborted){const ticker=selected[cursor++],symbol=ticker.symbol.replace(/USDT$/,''),price=Number(ticker.lastPrice);try{const results={},bars={};for(const tf of ['5m','3m','15m']){bars[tf]=await getBars(ticker.symbol,tf,signal);results[tf]=analyseBars(bars[tf],rules)}
 const signals=results['5m'].signals.filter(s=>s.kind!=='volume').map(s=>({...s,source:exchange,symbol,price,change:(price/s.entry-1)*100}));next.signals.push(...signals,...volumeHistory(symbol,bars['3m'],price));
 next.charts.push({symbol,frames:{'5m':results['5m'].frames,'15m':results['15m'].frames},alignment:{'5m':results['5m'].alignment,'15m':results['15m'].alignment},change:results['5m'].change});
 next.td.push({symbol,buy5:results['5m'].td.buy,sell5:results['5m'].td.sell,buy15:results['15m'].td.buy,sell15:results['15m'].td.sell});const monitor=monitorRecord(symbol,bars['5m'],price);if(monitor)next.monitor.push(monitor);
 try{if(!supportsAccountRatios)throw new MarketError('该交易所账户多空比尚未接入','DATASET_UNAVAILABLE');const ratios=await request(`/futures/data/globalLongShortAccountRatio?symbol=${ticker.symbol}&period=5m&limit=49`,{signal});if(!Array.isArray(ratios)||!ratios.length)throw new Error('empty');const sorted=[...ratios].sort((a,b)=>Number(a.timestamp)-Number(b.timestamp)),last=sorted.at(-1);if(![last.timestamp,last.longShortRatio,last.longAccount,last.shortAccount].every(v=>v!=null&&Number.isFinite(Number(v)))||Number(last.longShortRatio)<=0||Number(last.longAccount)<0||Number(last.longAccount)>1||Number(last.shortAccount)<0||Number(last.shortAccount)>1)throw new Error('invalid');if(now()-Number(last.timestamp)>900000)throw new Error('stale');const change=(n)=>{const previous=sorted.at(-1-n);return previous&&Number(previous.longShortRatio)>0?(Number(last.longShortRatio)/Number(previous.longShortRatio)-1)*100:null};next.smartMoney.push({symbol:ticker.symbol,ratio:Number(last.longShortRatio),longAccount:Number(last.longAccount),shortAccount:Number(last.shortAccount),change5m:change(1),change30m:change(6),change4h:change(48),price,at:new Date(Number(last.timestamp)).toISOString()})}catch{smartFailed.push(symbol)}
 }catch(error){failed.push({symbol,code:error.code||'SCAN_ERROR',message:error.message});if(['REGION_RESTRICTED','RATE_LIMITED'].includes(error.code)){fatal=error;controller.abort()}}}}));
 if(fatal)throw fatal;if(signal.aborted)throw new MarketError('行情采集已停止','ABORTED');if(!next.charts.length)throw new MarketError(failed[0]?.message||'全部合约扫描失败','SCAN_FAILED');
 next.signals.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));next.monitor.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));next.smartMoney.sort((a,b)=>b.ratio-a.ratio);data=next;
 const keep=new Set(selected.flatMap(t=>Object.keys(timeframeMs).map(tf=>t.symbol+':'+tf)));for(const key of barsCache.keys())if(!keep.has(key))barsCache.delete(key);
 state={...state,ready:true,cached:false,updatedAt:new Date(now()).toISOString(),symbolCount:next.charts.length,partialFailures:failed,smartMoneyAvailable:next.smartMoney.length>0,smartMoneyFailures:smartFailed,error:failed.length?`${failed.length}个合约未完成扫描`:null,errorCode:failed.length?'PARTIAL_SCAN':null};failures=0;
 try{save({version:1,source:exchange,updatedAt:state.updatedAt,data,bars:[...barsCache]});state.cacheError=null}catch{state.cacheError='本次结果已更新，但缓存保存失败'}return status();
 }catch(error){failures++;state={...state,error:error.message,errorCode:error.code||'UPSTREAM_ERROR'};throw error}finally{state.running=false;controller?.abort();controller=null}}
 function schedule(delay){if(!started||stopped)return;clearTimer(timer);state.nextRunAt=new Date(now()+delay).toISOString();timer=setTimer(()=>{timer=null;void runScheduled()},delay);timer?.unref?.()}
 async function runScheduled(){if(stopped)return;let delay=intervalMs;try{await sync({background:true})}catch(error){delay=Math.max(error.retryAfterMs||0,Math.min(900000,intervalMs*2**Math.min(4,Math.max(0,failures-1))))}finally{schedule(delay)}}
 function sync({background=false}={}){if(inflight)return inflight;if(stopped)return Promise.reject(new MarketError('行情服务已停止','STOPPED'));if(!background&&lastAttempt!=null&&now()-lastAttempt<30000)return Promise.reject(new MarketError('后台正在定时采集，请等待30秒后再手动刷新','COOLDOWN'));inflight=scan().finally(()=>{inflight=null}).then(()=>status());return inflight}
 return{status,data:()=>data,sync,start(){if(started)return;started=true;stopped=false;state.automatic=true;schedule(0)},async stop(){stopped=true;started=false;state.automatic=false;state.nextRunAt=null;clearTimer(timer);controller?.abort();if(inflight)await inflight.catch(()=>{})}};
}
