import type {Candle,Direction} from './engine';
export type SignalOutcome={status:'success'|'failure'|'flat'|'pending'|'missing';dueAt:string;price:number|null;changePercent:number|null};
/** Observe the signal candle's close versus the exact close ten minutes later.
 * This is directional accuracy, not the backtest's next-open execution model. */
export function signalOutcome(rows:Candle[],index:number,direction:Direction):SignalOutcome{
 const entry=rows[index],signalTime=entry?Date.parse(entry.datetime)+60_000:NaN,due=signalTime+600_000;
 const empty={dueAt:Number.isFinite(due)?new Date(due).toISOString():'',price:null,changePercent:null};
 if(!entry||!Number.isFinite(due)||!Number.isFinite(entry.close)||entry.close<=0||direction==='neutral')return {...empty,status:'missing'};
 const candidate=rows[index+10];
 const settled=candidate&&Date.parse(candidate.datetime)+60_000===due?candidate:rows.find(row=>Date.parse(row.datetime)+60_000===due);
 if(!settled){const latest=rows.at(-1);return {...empty,status:latest&&Date.parse(latest.datetime)+60_000>=due?'missing':'pending'};}
 if(!Number.isFinite(settled.close)||settled.close<=0)return {...empty,status:'missing'};
 const delta=settled.close-entry.close;
 return {...empty,price:settled.close,changePercent:delta/entry.close*100,status:delta===0?'flat':(direction==='bullish'?delta>0:delta<0)?'success':'failure'};
}
export const outcomeLabels={success:'成功',failure:'失败',flat:'持平',pending:'观察中',missing:'等待对应行情'};
