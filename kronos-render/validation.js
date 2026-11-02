'use strict';
(()=>{
 const $=s=>document.querySelector(s),ns='http://www.w3.org/2000/svg';let version=0,reportPromise;
 const num=value=>Number.isFinite(value)?new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(value):'—';
 const utc=t=>/Z$|[+-]\d\d:\d\d$/.test(t)?t:t.replace(' ','T')+'Z';
 const time=t=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(utc(t)));
 const key=data=>[data.metadata.symbol,data.metadata.interval,Date.parse(utc(data.metadata.generated_at_utc)),Date.parse(utc(data.paths[0][0].timestamps)),data.paths.length].join('|');
 function element(name,attrs,text){const e=document.createElementNS(ns,name);for(const [k,v]of Object.entries(attrs||{}))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
 function chart(entry){
  const svg=$('#validation-chart');svg.replaceChildren();const rows=entry.rows,base=entry.baseline_close;
  const values=[base,...rows.flatMap(r=>[r.predicted_median,r.actual_close].filter(Number.isFinite))],min0=Math.min(...values),max0=Math.max(...values),pad=(max0-min0)*.12||1,min=min0-pad,max=max0+pad;
  const L=90,R=25,T=24,B=45,w=1100,h=360,x=i=>L+i/24*(w-L-R),y=v=>T+(max-v)/(max-min)*(h-T-B);
  for(let i=0;i<5;i++){const value=min+(max-min)*i/4;svg.append(element('line',{x1:L,x2:w-R,y1:y(value),y2:y(value),stroke:'#e5ece7'}),element('text',{x:L-12,y:y(value)+4,'text-anchor':'end'},num(value)));}
  svg.append(element('line',{x1:L,x2:w-R,y1:y(base),y2:y(base),stroke:'#8c9a91','stroke-dasharray':'3 4'}));
  const line=(points,color,dash)=>{if(!points.length)return;const poly=element('polyline',{points:points.map(([i,v])=>`${x(i)},${y(v)}`).join(' '),fill:'none',stroke:color,'stroke-width':2.8,'stroke-linejoin':'round'});if(dash)poly.setAttribute('stroke-dasharray',dash);svg.append(poly);};
  line([[0,base],...rows.map((r,i)=>[i+1,r.predicted_median])],'#236044','6 4');
  let segment=[[0,base]];rows.forEach((r,i)=>{if(Number.isFinite(r.actual_close))segment.push([i+1,r.actual_close]);else{line(segment,'#d47538');segment=[];}});line(segment,'#d47538');
  rows.forEach((r,i)=>{if(Number.isFinite(r.actual_close)){const circle=element('circle',{cx:x(i+1),cy:y(r.actual_close),r:3.2,fill:'#d47538'});circle.append(element('title',{},`${time(r.timestamps)} · 真实 ${num(r.actual_close)} · 预测 ${num(r.predicted_median)}`));svg.append(circle);}});
  for(const i of [0,23])svg.append(element('text',{x:x(i+1),y:h-12,'text-anchor':i===0?'start':'end'},time(rows[i].timestamps)));
 }
 async function render(data){
  const current=++version;$('#validation-body').hidden=true;$('#validation-status').textContent='正在读取这份预测的真实走势对照…';
  try{
   if(!reportPromise)reportPromise=fetch('/kronos/evaluations.json',{cache:'no-store'}).then(async r=>r.ok?r.json():null);
   const report=await reportPromise;if(current!==version)return;const entry=report?.entries?.[key(data)];
   if(!entry){$('#validation-status').textContent='这份预测尚无对照报告。可点击右上方更新任务；后台本地导入的记录不会自动上传到 GitHub 验证。';return;}
   if(!Array.isArray(entry.rows)||entry.rows.length!==24){$('#validation-status').textContent='真实行情暂时无法获取，当前没有可评分的数据。请稍后重新运行更新任务。';return;}
   $('#validation-body').hidden=false;
   const labels={complete:'24 根已走完',partial:'进行中：预测窗口尚未走完',pending:'等待第一根预测 K 线收盘',incomplete_data:'真实行情存在缺口，尚未完整匹配'};
   $('#validation-status').textContent=(entry.fetch_error?'本次更新行情失败，显示上一次验证：':'')+(labels[entry.state]||'正在核验');
   $('#validation-count').textContent=entry.matched_count+' / 24';$('#validation-mae').textContent=num(entry.mae);$('#validation-baseline').textContent=num(entry.baseline_mae);$('#validation-mape').textContent=Number.isFinite(entry.mape_pct)?num(entry.mape_pct)+'%':'—';$('#validation-coverage').textContent=Number.isFinite(entry.sample_coverage_pct)?num(entry.sample_coverage_pct)+'%':'—';
   $('#validation-direction').textContent=entry.direction_hit===null?'待完整事前窗口':entry.direction_hit?'一致':'不一致';
   let verdict=entry.scored_count?`当前统计 ${entry.scored_count} 根可评分 K 线。`:'目前没有可评分的已收盘 K 线。';
   if(entry.mae!==null)verdict+=entry.beats_baseline?' 在这些已匹配点上，预测中位线误差小于价格不变基线。':' 在这些已匹配点上，预测中位线未优于价格不变基线。';
   if(entry.excluded_count)verdict+=` ${entry.excluded_count} 根在预测生成时已经收盘，不计入事前验证。`;
   if(entry.state!=='complete')verdict+=' 这不是完整 24 根预测的最终评分。';$('#validation-verdict').textContent=verdict;
   $('#validation-paths').textContent=entry.path_mae?.length?'各条独立路径平均绝对误差：'+entry.path_mae.map((v,i)=>`路径 ${i+1} ${num(v)}`).join(' · ')+'。不挑选事后最像的一条作为整体成绩。':'';
   $('#validation-checked').textContent='真实行情核验时间：'+time(entry.checked_at_utc)+'（北京时间）；本批次完整事前预测窗口 '+report.complete_forward_count+' 份。';
   const tbody=$('#validation-rows');tbody.replaceChildren();entry.rows.forEach(r=>{const tr=document.createElement('tr');for(const text of [time(r.timestamps),num(r.predicted_median),num(r.actual_close),Number.isFinite(r.actual_close)&&r.eligible?num(Math.abs(r.predicted_median-r.actual_close)):r.actual_close===null?'未收盘 / 缺失':'不计入']){const td=document.createElement('td');td.textContent=text;tr.append(td);}tbody.append(tr);});chart(entry);
  }catch{reportPromise=null;if(current===version)$('#validation-status').textContent='暂时无法读取对照报告，预测图表仍可正常查看。';}
 }
 window.KronosValidation={render};
})();
