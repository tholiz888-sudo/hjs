import {createHash} from 'node:crypto';
const periods={ma:300000,supertrend:300000,volume:180000};
export function createSignalJournal({now=Date.now,load=()=>null,save=()=>{},onSignal=()=>{}}={}){
 const cache=new Map();
 function observe(source,symbol,signals,confirmedAt){
  const key=source+':'+symbol;let state=cache.get(key);if(!state){state=load(key)||{initialized:false,active:{},records:{}};cache.set(key,state)}
  const active={},stamp=new Date(now()).toISOString();
  const rows=signals.map(row=>{const previous=state.active[row.kind],continuation=previous?.bias===row.bias;
   const run=row.kind==='volume'?row.at:continuation?previous.run:confirmedAt;
   const candidateCross=row.crossAt||row.cross||(continuation?previous.cross:'none');
   const historicalRevision=continuation&&row.crossAt&&Number.isFinite(Date.parse(previous.lastConfirmedAt))&&Date.parse(row.crossAt)+periods.ma<=Date.parse(previous.lastConfirmedAt);
   const cross=row.kind==='ma'?(historicalRevision?previous.cross:candidateCross):'';
   const id=createHash('sha256').update(JSON.stringify([source,symbol,row.kind,row.bias,run,cross])).digest('hex').slice(0,32);
   const closed=row.kind==='volume'?Date.parse(row.at)+periods.volume:Date.parse(confirmedAt);
   let record=state.records[id];
   if(!record){const crossed=row.kind==='ma'&&continuation&&previous.cross!==cross;const eventTime=crossed&&row.crossAt?Date.parse(row.crossAt)+periods.ma:closed;
    const timely=Number.isFinite(eventTime)&&eventTime<=now()+1500&&now()-eventTime<=600000;
    record={signalId:id,confirmedAt:Number.isFinite(eventTime)?new Date(eventTime).toISOString():null,detectedAt:stamp,detectedPrice:row.price,alertable:state.initialized&&timely,discovery:!state.initialized?'initial-scan':!timely?'backfill':crossed?'macd-cross':'new-condition'};state.records[id]=record;
    if(record.alertable)onSignal({...row,...record,source,symbol});
   }
   if(row.kind!=='volume')active[row.kind]={bias:row.bias,run,cross,lastConfirmedAt:confirmedAt};
   return{...row,...record,lastConfirmedAt:Number.isFinite(closed)?new Date(closed).toISOString():null};
  });
  state.active=active;state.initialized=true;state.updatedAt=stamp;
  const ids=Object.keys(state.records);if(ids.length>256)for(const id of ids.sort((a,b)=>Date.parse(state.records[b].confirmedAt||state.records[b].detectedAt)-Date.parse(state.records[a].confirmedAt||state.records[a].detectedAt)).slice(256))delete state.records[id];
  save(key,state);return rows;
 }
 return{observe};
}
