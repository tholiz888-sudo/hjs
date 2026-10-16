import {MarketError} from './market-error.mjs';
export function abortableWait(ms,signal){return new Promise((resolve,reject)=>{if(signal?.aborted)return reject(new MarketError('行情采集已停止','ABORTED'));const abort=()=>{clearTimeout(timer);reject(new MarketError('行情采集已停止','ABORTED'))};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},ms);signal?.addEventListener('abort',abort,{once:true})})}
// Conservative rolling request budgets; 429/418 responses still trigger backoff.
export function createRequestBudget({weightPerMinute=1000,ratiosPerFiveMinutes=800,now=Date.now,wait=abortableWait}={}){const entries={weight:[],ratios:[]};const chains={weight:Promise.resolve(),ratios:Promise.resolve()};
 function take(path,{signal}={}){const url=new URL(path,'https://internal.invalid'),ratios=url.pathname.startsWith('/futures/data/'),kind=ratios?'ratios':'weight',windowMs=ratios?300000:60000,capacity=ratios?ratiosPerFiveMinutes:weightPerMinute;const limit=Number(url.searchParams.get('limit')||500);let cost=1;if(!ratios&&url.pathname.endsWith('/ticker/24hr')&&!url.searchParams.has('symbol'))cost=40;if(!ratios&&url.pathname.endsWith('/klines'))cost=limit<100?1:limit<500?2:limit<=1000?5:10;
 if(cost>capacity)return Promise.reject(new MarketError('请求预算小于单次请求权重','INVALID_BUDGET'));
 const task=chains[kind].then(async()=>{while(true){if(signal?.aborted)throw new MarketError('行情采集已停止','ABORTED');const t=now();entries[kind]=entries[kind].filter(e=>t-e.at<windowMs);if(entries[kind].reduce((sum,e)=>sum+e.cost,0)+cost<=capacity){entries[kind].push({at:t,cost});return}await wait(Math.max(1,windowMs-(t-entries[kind][0].at)+1),signal)}});chains[kind]=task.catch(()=>{});return task;
 }
 return{take};
}
