'use client';
import { useId, useState } from 'react';
import { ChartNoAxesCombined } from 'lucide-react';
import { D, format, netAtPrice, type Result } from '@/lib/calculations';
import type { Plan } from '@/lib/types';
export function PnlChart({plan:p,result:r}:{plan:Plan;result:Result}) {
 const id=useId().replace(/:/g,''), [hover,setHover]=useState<number|null>(null);
 const markers=[{name:'止损',price:r.stop,color:'var(--red)'},{name:'入场',price:new D(p.entry),color:'var(--muted)'},{name:'盈亏平衡',price:r.breakEven,color:'var(--yellow)'},...r.targets.map((t,i)=>({name:`TP${i+1}`,price:t.price,color:'var(--green)'}))];
 const min=D.min(...markers.map(m=>m.price)),max=D.max(...markers.map(m=>m.price)),range=max.minus(min),lo=D.max(0,min.minus(range.mul('.12'))),hi=max.plus(range.mul('.12'));
 const start=netAtPrice(p,r,lo),end=netAtPrice(p,r,hi),yMin=D.min(start,end,0).minus(r.budget.mul('.2')),yMax=D.max(start,end,0).plus(r.budget.mul('.2'));
 const x=(price:InstanceType<typeof D>)=>64+price.minus(lo).div(hi.minus(lo)).toNumber()*650;
 const y=(net:InstanceType<typeof D>)=>198-net.minus(yMin).div(yMax.minus(yMin)).toNumber()*166;
 const x0=x(lo),x1=x(hi),y0=y(start),y1=y(end),zero=y(new D(0));
 const pointerPrice=hover===null?null:lo.plus(hi.minus(lo).mul(hover));
 const digits=Number(p.priceDecimals);
 return <section className="panel chart-panel"><div className="panel-heading"><span className="section-icon"><ChartNoAxesCombined size={17}/></span><h2>盈亏分析</h2><span className="chart-legend"><i/>预估净盈亏</span></div><div className="chart-wrap"><div className="chart-axis-title">净盈亏 <span>USDT</span></div><svg viewBox="0 0 750 250" role="img" aria-label={`${p.direction==='long'?'做多':'做空'}仓位净盈亏图，止损 ${format(r.loss)} USDT，盈亏平衡价 ${r.breakEven.toFixed(digits)}`} onPointerMove={e=>{const box=e.currentTarget.getBoundingClientRect();setHover(Math.max(0,Math.min(1,((e.clientX-box.left)/box.width*750-64)/650)));}} onPointerLeave={()=>setHover(null)}>
 <defs><linearGradient id={`gain-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0ECB81" stopOpacity=".2"/><stop offset="100%" stopColor="#0ECB81" stopOpacity=".01"/></linearGradient><clipPath id={`pos-${id}`}><rect x="64" y="20" width="650" height={Math.max(0,zero-20)}/></clipPath><clipPath id={`neg-${id}`}><rect x="64" y={zero} width="650" height={Math.max(0,210-zero)}/></clipPath></defs>
 {[0,.25,.5,.75,1].map(t=>{const v=yMin.plus(yMax.minus(yMin).mul(t)),yy=y(v);return <g key={t}><line x1="64" x2="714" y1={yy} y2={yy} className="gridline"/><text x="52" y={yy+4} textAnchor="end">{format(v,0)}</text></g>})}
 <line x1="64" x2="714" y1={zero} y2={zero} className="zero-line"/>
 <path d={`M${x0} ${zero} L${x0} ${y0} L${x1} ${y1} L${x1} ${zero} Z`} fill={`url(#gain-${id})`} clipPath={`url(#pos-${id})`}/>
 <path d={`M${x0} ${zero} L${x0} ${y0} L${x1} ${y1} L${x1} ${zero} Z`} fill="#F6465D" fillOpacity=".08" clipPath={`url(#neg-${id})`}/>
 <line x1={x0} x2={x1} y1={y0} y2={y1} stroke="var(--green)" strokeWidth="2.5" clipPath={`url(#pos-${id})`}/><line x1={x0} x2={x1} y1={y0} y2={y1} stroke="var(--red)" strokeWidth="2.5" clipPath={`url(#neg-${id})`}/>
 {markers.map((m,i)=><g key={m.name}><line x1={x(m.price)} x2={x(m.price)} y1="30" y2="202" stroke={m.color} strokeOpacity=".28" strokeDasharray="3 5"/><circle cx={x(m.price)} cy={y(netAtPrice(p,r,m.price))} r="4" fill={m.color} stroke="var(--panel)" strokeWidth="2"/><text x={x(m.price)} y={i===2?18:218} textAnchor="middle" style={{fill:m.color}}>{m.name}</text>{i!==2&&<text className="chart-marker-price" x={x(m.price)} y="235" textAnchor="middle">{format(m.price,digits)}</text>}</g>)}
 {pointerPrice&&<g><line x1={x(pointerPrice)} x2={x(pointerPrice)} y1="25" y2="202" stroke="var(--text)" strokeDasharray="2 3"/><circle cx={x(pointerPrice)} cy={y(netAtPrice(p,r,pointerPrice))} r="4" fill="var(--text)"/></g>}
 </svg><div className="mobile-chart-markers">{markers.map(m=><div key={m.name}><span style={{color:m.color}}>{m.name}</span><b>{format(m.price,digits)}</b></div>)}</div><div className="chart-readout">{pointerPrice?`假设价格 ${format(pointerPrice,digits)} · 净盈亏 ${format(netAtPrice(p,r,pointerPrice))} USDT`:`盈亏平衡价 ${format(r.breakEven,digits)} USDT`}<span>标的价格 →</span></div><p className="chart-caption">假设全仓于横轴价格平仓，计入所设交易成本；不代表实际成交结果。</p></div></section>;
}
