import type {Candle} from './engine';
/** Wilder TR/+DM/-DM smoothing, first ATR at n and first ADX at 2n-1.
 * Null means insufficient history, rather than an artificial zero reading. */
export function wilderTrend(rows:Candle[],period:number){
 const atr:(number|null)[]=rows.map(()=>null),adx:(number|null)[]=rows.map(()=>null);
 let trSum=0,plusSum=0,minusSum=0,dxSum=0,dxCount=0,average:number|null=null;
 for(let i=1;i<rows.length;i++){
  const row=rows[i],previous=rows[i-1],up=row.high-previous.high,down=previous.low-row.low;
  const tr=Math.max(row.high-row.low,Math.abs(row.high-previous.close),Math.abs(row.low-previous.close)),plus=up>down&&up>0?up:0,minus=down>up&&down>0?down:0;
  if(i<=period){trSum+=tr;plusSum+=plus;minusSum+=minus;}else{trSum=trSum-trSum/period+tr;plusSum=plusSum-plusSum/period+plus;minusSum=minusSum-minusSum/period+minus;}
  if(i<period)continue;
  atr[i]=trSum/period;
  const plusDi=trSum===0?0:100*plusSum/trSum,minusDi=trSum===0?0:100*minusSum/trSum,dx=plusDi+minusDi===0?0:100*Math.abs(plusDi-minusDi)/(plusDi+minusDi);
  if(average===null){dxSum+=dx;dxCount++;if(dxCount===period)average=dxSum/period;}else average=(average*(period-1)+dx)/period;
  adx[i]=average;
 }
 return {atr,adx};
}
