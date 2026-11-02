'use strict';
const $=s=>document.querySelector(s),ns='http://www.w3.org/2000/svg';
const fmtTime=t=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t.endsWith('Z')||/[+-]\d\d:\d\d$/.test(t)?t:t+'Z'));
const number=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(n);
function element(name,attrs={},text){const e=document.createElementNS(ns,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function valid(data){
  if(!data||data.history?.length!==512||!Array.isArray(data.paths)||data.paths.length<2||data.paths.length>20||data.metadata?.context!==512||data.metadata?.horizon!==24)throw Error('结果格式不完整，无法展示。');
  for(const series of [data.history,...data.paths]){if(series!==data.history&&series.length!==24)throw Error('预测路径长度无效。');for(const row of series){if(!/^\d{4}-\d\d-\d\dT[0-9:.]+Z?$/.test(row.timestamps)||!Number.isFinite(Date.parse(row.timestamps)))throw Error('时间无效。');for(const key of ['open','high','low','close','volume','amount'])if(!Number.isFinite(row[key]))throw Error('结果包含无效数值。');}}
  for(const series of data.paths)if(series.some((r,i)=>r.timestamps!==data.paths[0][i].timestamps))throw Error('各路径时间不一致。');
}
const pathColors=['#347fbd','#d78c2e','#9264be','#219b7d','#cf667c'];
const median=values=>{const a=[...values].sort((x,y)=>x-y),i=a.length>>1;return a.length%2?a[i]:(a[i-1]+a[i])/2;};
const percent=v=>(v>0?'+':'')+v.toFixed(2)+'%';
let displaySettings={defaultView:'future',showBand:true,showMedian:true,showComparison:true,showTable:true};
function draw(data){
  const svg=$('#chart'),base=data.history.at(-1).close;
  $('#chart-legend').textContent=[displaySettings.showBand?'浅绿色区域：样本最低至最高收盘价':null,displaySettings.showMedian?'深色虚线：逐根样本中位数':null,'彩色线：独立采样路径'].filter(Boolean).join(' · ');
  if(base<=0)throw Error('历史基准价格无效。');
  const summaries=data.paths[0].map((row,i)=>{const values=data.paths.map(p=>p[i].close);return {timestamps:row.timestamps,min:Math.min(...values),max:Math.max(...values),mid:median(values)};});
  const terminal=summaries.at(-1),change=value=>(value/base-1)*100;
  $('#base-price').textContent=number(base);$('#end-median').textContent=number(terminal.mid);
  $('#median-change').textContent=percent(change(terminal.mid));$('#median-change').className=change(terminal.mid)>=0?'positive':'negative';
  $('#end-range').textContent=percent(change(terminal.min))+' 至 '+percent(change(terminal.max));
  let view=displaySettings.defaultView==='history'?'history':'future',selected=null;
  $('#comparison-section').hidden=!displaySettings.showComparison;$('#table-section').hidden=!displaySettings.showTable;
  const controls=$('#path-controls');controls.replaceChildren();
  const buttons=[];
  function select(index){selected=index;buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String((i===0&&selected===null)||i===selected+1&&selected!==null)));render();}
  for(let i=-1;i<data.paths.length;i++){
    const button=document.createElement('button');button.className='path-button';button.type='button';button.setAttribute('aria-pressed',String(i===-1));
    if(i>=0){const dot=document.createElement('span');dot.className='path-swatch';dot.style.backgroundColor=pathColors[i%pathColors.length];button.append(dot);}
    button.append(document.createTextNode(i===-1?'全部路径':`路径 ${i+1}`));button.onclick=()=>select(i===-1||selected===i?null:i);controls.append(button);buttons.push(button);
  }
  const comparison=$('#path-comparison');comparison.replaceChildren();
  const changes=data.paths.map(p=>change(p.at(-1).close)),limit=Math.max(...changes.map(Math.abs),.01);
  changes.forEach((value,i)=>{
    const row=document.createElement('div');row.className='comparison-row';
    const name=document.createElement('button');name.type='button';name.className='comparison-name';name.textContent=`路径 ${i+1}`;name.onclick=()=>select(selected===i?null:i);
    const track=document.createElement('div');track.className='comparison-track';const zero=document.createElement('span');zero.className='comparison-zero';const bar=document.createElement('span');bar.className='comparison-bar';const width=Math.abs(value)/limit*50;bar.style.width=width+'%';bar.style.left=(value<0?50-width:50)+'%';bar.style.backgroundColor=pathColors[i%pathColors.length];track.append(zero,bar);
    const label=document.createElement('span');label.className='comparison-value '+(value>=0?'positive':'negative');label.textContent=percent(value);row.append(name,track,label);comparison.append(row);
  });
  $('#focus-future').onclick=()=>{view='future';render();};$('#focus-history').onclick=()=>{view='history';render();};
  function render(){
    svg.replaceChildren();$('#focus-future').setAttribute('aria-pressed',String(view==='future'));$('#focus-history').setAttribute('aria-pressed',String(view==='history'));
    const history=data.history.slice(view==='future'?-1:-96),n=history.length+24,values=[...history.map(r=>r.close),...data.paths.flatMap(p=>p.map(r=>r.close))];
    const lo=Math.min(...values),hi=Math.max(...values),pad=(hi-lo)*.12||1,min=lo-pad,max=hi+pad,w=1100,h=420,L=90,R=25,T=32,B=50;
    const x=i=>L+i/(n-1)*(w-L-R),y=v=>T+(max-v)/(max-min)*(h-T-B),start=history.length-1;
    for(let i=0;i<5;i++){const v=min+(max-min)*i/4,py=y(v);svg.append(element('line',{x1:L,y1:py,x2:w-R,y2:py,stroke:'#e6eee8'}),element('text',{x:L-12,y:py+4,'text-anchor':'end'},number(v)));}
    const upper=[{max:base},...summaries],lower=[{min:base},...summaries];
    const points=[...upper.map((r,i)=>`${x(start+i)},${y(r.max)}`),...lower.map((_,j)=>{const i=lower.length-1-j;return `${x(start+i)},${y(lower[i].min)}`;})].join(' ');
    const band=element('polygon',{points,fill:'#8fbda3','fill-opacity':'.27','data-series':'sample-range'});band.append(element('title',{},'各时点采样最低至最高收盘价范围，不是置信区间'));if(displaySettings.showBand)svg.append(band);
    function line(rows,offset,color,width=2,opacity=.85,dash){const e=element('polyline',{points:rows.map((r,i)=>`${x(offset+i)},${y(r.close)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-opacity':opacity,'stroke-linejoin':'round','stroke-linecap':'round'});if(dash)e.setAttribute('stroke-dasharray',dash);svg.append(e);return e;}
    line(history,0,'#17382d',2.5);
    data.paths.forEach((p,i)=>{const e=line([history.at(-1),...p],start,pathColors[i%pathColors.length],selected===i?3.7:2,selected!==null&&selected!==i?.16:.85);e.append(element('title',{},`路径 ${i+1} · 末根涨跌幅 ${percent(changes[i])}`));});
    if(displaySettings.showMedian)line([{close:base},...summaries.map(r=>({close:r.mid}))],start,'#235a42',2.7,.95,'6 5');
    svg.append(element('line',{x1:L,x2:w-R,y1:y(base),y2:y(base),stroke:'#7a9585','stroke-dasharray':'3 5','stroke-opacity':'.55'}));
    if(view==='history')svg.append(element('line',{x1:x(start),x2:x(start),y1:T,y2:h-B,stroke:'#708b7d','stroke-dasharray':'5 5'}));
    for(const [index,row]of [[0,history[0]],[n-1,data.paths[0].at(-1)]])svg.append(element('text',{x:x(index),y:h-15,'text-anchor':index===0?'start':'end'},fmtTime(row.timestamps)));
    svg.append(element('text',{x:x(start)+8,y:20},'预测起点'));
    const cursor=element('line',{x1:0,x2:0,y1:T,y2:h-B,stroke:'#557f67','stroke-dasharray':'3 3',visibility:'hidden'}),dot=element('circle',{cx:0,cy:0,r:5,fill:'#235a42',stroke:'white','stroke-width':2,visibility:'hidden'});svg.append(cursor,dot);
    let active=history.length-1;
    function inspect(index){active=Math.max(0,Math.min(n-1,index));cursor.setAttribute('x1',x(active));cursor.setAttribute('x2',x(active));cursor.setAttribute('visibility','visible');
      if(active<history.length){const row=history[active];dot.setAttribute('cx',x(active));dot.setAttribute('cy',y(row.close));$('#inspect').textContent=`${fmtTime(row.timestamps)} · 历史收盘价 ${number(row.close)}`;}
      else{const i=active-history.length,r=summaries[i];dot.setAttribute('cx',x(active));dot.setAttribute('cy',y(r.mid));$('#inspect').textContent=`第 ${i+1} 根 · ${fmtTime(r.timestamps)} · 样本范围 ${number(r.min)}–${number(r.max)} · 中位数 ${number(r.mid)} · `+data.paths.map((p,j)=>`路径 ${j+1}：${number(p[i].close)}`).join(' / ');}
      dot.setAttribute('visibility','visible');
    }
    $('#inspect').textContent='移入图表查看数值，也可聚焦图表后使用左右方向键。';
    svg.onpointermove=event=>{const rect=svg.getBoundingClientRect();inspect(Math.round(((event.clientX-rect.left)/rect.width*w-L)/(w-L-R)*(n-1)));};
    svg.onpointerleave=()=>{cursor.setAttribute('visibility','hidden');dot.setAttribute('visibility','hidden');};
    svg.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();inspect(event.key==='Home'?0:event.key==='End'?n-1:active+(event.key==='ArrowLeft'?-1:1));}};
  }
  render();
}
function csv(data){
  const columns=['path','timestamps_utc','open','high','low','close','volume','amount'];
  const lines=[columns.join(',')];data.paths.forEach((p,i)=>p.forEach(row=>lines.push([i+1,row.timestamps.replace(/Z?$/,'Z'),...columns.slice(2).map(c=>row[c])].join(','))));
  const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='kronos-paths.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function load(){
  try{
    try{const settingsResponse=await fetch('/kronos/settings.json',{cache:'no-store'});if(settingsResponse.ok){const setting=await settingsResponse.json();if(typeof setting.title==='string'){displaySettings=setting;$('#page-title').textContent=setting.title;$('#page-description').textContent=setting.description;$('#recommended').textContent=`推荐生成参数：${setting.defaultSymbol} / ${setting.defaultInterval} / ${setting.defaultPaths} 条路径（进入 GitHub 后手动选择）`;}}}catch{}
    try{const historyResponse=await fetch('/kronos/history.json',{cache:'no-store'});if(historyResponse.ok){const value=await historyResponse.json();if(Array.isArray(value.history)){const select=$('#history-select');select.replaceChildren();for(const record of value.history){const option=document.createElement('option');option.value=record.id;option.textContent=`${fmtTime(record.generated_at_utc)} · ${record.symbol} · ${record.interval} · ${record.paths} 条${record.current?'（当前展示）':''}`;option.selected=record.current;select.append(option);}$('#history-toolbar').hidden=value.history.length<2;select.onchange=async()=>{try{const r=await fetch('/kronos/forecast.json?id='+encodeURIComponent(select.value),{cache:'no-store'});if(!r.ok)throw Error('历史记录已不可用，请刷新页面。');showForecast(await r.json());}catch(e){$('#status').textContent=e.message;}};}}}catch{}
    const response=await fetch('/kronos/forecast.json',{cache:'no-store'});if(response.status===404){$('#status').textContent='尚未生成真实预测。请点击上方“选择币种并生成（GitHub）”，运行预测任务；任务成功并完成网站部署后，再刷新此页。';return;}if(!response.ok)throw Error('读取结果失败，请稍后重试。');const data=await response.json();valid(data);const m=data.metadata;
    $('#pair').textContent=`${m.symbol} · ${m.interval} · ${data.paths.length} 条路径`;$('#last').textContent=fmtTime(m.last_closed_open_time_utc.replace(' ','T'));$('#generated').textContent=fmtTime(m.generated_at_utc);
    $('#status').textContent='已加载所选预测结果，生成时间与参数见下方。需要更新时，请运行上方的 GitHub 预测任务。';$('#result').hidden=false;
    if(typeof window!=='undefined')window.KronosValidation?.render(data);
    draw(data);$('#range').textContent=`预测时间：${fmtTime(data.paths[0][0].timestamps)} 至 ${fmtTime(data.paths[0].at(-1).timestamps)}（北京时间，K 线开盘时间）`;
    $('#stale').textContent=Date.now()>(Date.parse(data.paths[0].at(-1).timestamps.replace(/Z?$/,'Z'))+({'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000}[m.interval]||0))?'该预测窗口已经过去，请按历史时点推演查看；需要新结果时请运行新的 GitHub 预测任务。':'';
    $('#rows').replaceChildren();
    data.paths[0].forEach((r,i)=>{const values=data.paths.map(p=>p[i].close).sort((a,b)=>a-b),k=values.length>>1,median=values.length%2?values[k]:(values[k-1]+values[k])/2,tr=document.createElement('tr');for(const value of [fmtTime(r.timestamps),number(values[0]),number(median),number(values.at(-1))]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('#rows').append(tr);});
    $('#download').onclick=()=>csv(data);$('#source').textContent=m.source;
  }catch(error){$('#result').hidden=true;$('#status').textContent=error.message||'无法加载结果。';}
}
load();
