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
function draw(data){
  const svg=$('#chart'),history=data.history.slice(-96),future=data.paths[0],all=[history,...data.paths].flat(),values=all.map(r=>r.close),lo=Math.min(...values),hi=Math.max(...values),pad=(hi-lo)*.08||1,min=lo-pad,max=hi+pad,w=1100,h=420,L=90,R=25,T=25,B=50,n=history.length+24;
  const x=i=>L+i/(n-1)*(w-L-R),y=v=>T+(max-v)/(max-min)*(h-T-B);
  for(let i=0;i<5;i++){const v=min+(max-min)*i/4,py=y(v);svg.append(element('line',{x1:L,y1:py,x2:w-R,y2:py,stroke:'#e6eee8'}),element('text',{x:L-12,y:py+4,'text-anchor':'end'},number(v)));}
  const colors=['#347fbd','#e49331','#9264be','#219b7d','#d56378'];
  function line(rows,start,color,width=2){svg.append(element('polyline',{points:rows.map((r,i)=>`${x(start+i)},${y(r.close)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-opacity':'.8'}));}
  line(history,0,'#17382d',2.5);
  data.paths.forEach((p,i)=>line([history.at(-1),...p],history.length-1,colors[i%colors.length]));
  svg.append(element('line',{x1:x(history.length-1),x2:x(history.length-1),y1:T,y2:h-B,stroke:'#708b7d','stroke-dasharray':'5 5'}));
  for(const [index,row]of [[0,history[0]],[history.length-1,history.at(-1)],[n-1,future.at(-1)]]){svg.append(element('text',{x:x(index),y:h-15,'text-anchor':index===0?'start':index===n-1?'end':'middle'},fmtTime(row.timestamps)));}
}
function csv(data){
  const columns=['path','timestamps_utc','open','high','low','close','volume','amount'];
  const lines=[columns.join(',')];data.paths.forEach((p,i)=>p.forEach(row=>lines.push([i+1,row.timestamps.replace(/Z?$/,'Z'),...columns.slice(2).map(c=>row[c])].join(','))));
  const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='kronos-paths.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function connectOnline(){
  try{const response=await fetch('/kronos/config.json',{cache:'no-store'});if(!response.ok)return false;const config=await response.json();if(!config.spaceUrl)return false;const url=new URL(config.spaceUrl);if(url.protocol!=='https:'||url.username||url.password||! /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.hf\.space$/.test(url.hostname))return false;$('#space-frame').src=url.origin;$('#space-link').href=url.origin;$('#online').hidden=false;$('#status').hidden=true;return true;}catch{return false;}
}
async function load(){
  if(await connectOnline())return;
  try{const response=await fetch('/kronos/forecast.json',{cache:'no-store'});if(response.status===404){$('#status').textContent='尚未生成真实预测。在线预测服务尚未连接，当前也没有已发布结果；连接免费推理服务后，即可在此选择币种并生成。';return;}if(!response.ok)throw Error('读取结果失败，请稍后重试。');const data=await response.json();valid(data);const m=data.metadata;
    $('#pair').textContent=`${m.symbol} · ${m.interval} · ${data.paths.length} 条路径`;$('#last').textContent=fmtTime(m.last_closed_open_time_utc.replace(' ','T'));$('#generated').textContent=fmtTime(m.generated_at_utc);
    $('#status').textContent='已加载预先生成的结果。页面不会自动生成或刷新行情。';$('#result').hidden=false;
    draw(data);$('#range').textContent=`预测时间：${fmtTime(data.paths[0][0].timestamps)} 至 ${fmtTime(data.paths[0].at(-1).timestamps)}（北京时间，K 线开盘时间）`;
    if(Date.now()>Date.parse(data.paths[0].at(-1).timestamps.replace(/Z?$/,'Z')))$('#stale').textContent='该预测窗口已经过去，请按历史时点推演查看；需要新结果时请在本地重新生成并发布。';
    data.paths[0].forEach((r,i)=>{const values=data.paths.map(p=>p[i].close).sort((a,b)=>a-b),k=values.length>>1,median=values.length%2?values[k]:(values[k-1]+values[k])/2,tr=document.createElement('tr');for(const value of [fmtTime(r.timestamps),number(values[0]),number(median),number(values.at(-1))]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('#rows').append(tr);});
    $('#download').onclick=()=>csv(data);$('#source').textContent=m.source;
  }catch(error){$('#result').hidden=true;$('#status').textContent=error.message||'无法加载结果。';}
}
load();
