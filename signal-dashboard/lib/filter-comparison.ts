import {analyze,type Candle,type Params} from './engine';
import {signalOutcome} from './signal-outcome';
export function compareFilters(rows:Candle[],params:Params){
 const baseline={...params,adxEnabled:false,atrEnabled:false,deviationEnabled:false};
 const variants=[{id:'baseline',name:'原规则',params:baseline},{id:'adx',name:'仅 ADX',params:{...baseline,adxEnabled:true}},{id:'atr',name:'仅 ATR',params:{...baseline,atrEnabled:true}},{id:'deviation',name:'仅价格偏离',params:{...baseline,deviationEnabled:true}},{id:'selected',name:'当前组合',params}];
 return variants.map(variant=>{
  const observations=analyze(rows,variant.params).map((signal,index)=>({signal,index})).filter(row=>row.signal.direction!=='neutral').map(row=>({...signalOutcome(rows,row.index,row.signal.direction),index:row.index}));
  const settled=observations.filter(row=>['success','failure','flat'].includes(row.status)),wins=settled.filter(row=>row.status==='success').length,losses=settled.filter(row=>row.status==='failure').length,flats=settled.filter(row=>row.status==='flat').length;
  const tail=settled.filter(row=>row.index>=Math.floor(rows.length*.7)),tailWins=tail.filter(row=>row.status==='success').length;
  return {id:variant.id,name:variant.name,total:observations.length,settled:settled.length,wins,losses,flats,successRate:settled.length?wins/settled.length*100:null,tailCount:tail.length,tailRate:tail.length?tailWins/tail.length*100:null};
 });
}
