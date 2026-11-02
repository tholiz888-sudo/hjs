'use strict';
(()=>{
 const $=s=>document.querySelector(s),api=(document.body.dataset.adminBase||'')+'/admin/api/kronos',form=$('#settings-form'),status=$('#admin-status');let dirty=false;
 const switches=['showBand','showMedian','showComparison','showTable','autoLatest'];
 function message(text,error=false){status.textContent=text;status.className=error?'negative':'positive';}
 async function request(route,method='GET',data){const r=await fetch(api+route,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,cache:'no-store'});let value;try{value=await r.json();}catch{throw Error('管理服务暂时不可用');}if(!r.ok)throw Error(value.error||'操作失败');return value;}
 function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const time=t=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t));
 function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=async()=>{b.disabled=true;try{await action();}catch(e){message(e.message,true);}finally{b.disabled=false;}};return b;}
 async function load(){const data=await request('/state');for(const [key,value]of Object.entries(data.settings)){const field=form.elements.namedItem(key);if(field){if(switches.includes(key))field.checked=value;else field.value=value;}}dirty=false;const tbody=$('#admin-history');tbody.replaceChildren();
  for(const record of data.history){const tr=document.createElement('tr');for(const text of [time(record.generated_at_utc),record.symbol+' / '+record.interval,record.paths,record.current?'当前展示':'历史']){const td=document.createElement('td');td.textContent=text;tr.append(td);}const actions=document.createElement('td');actions.className='record-actions';const select=button('设为展示',async()=>{if(!confirm('切换首页展示到这份历史预测，并关闭自动最新？'))return;await request('/records/'+record.id+'/select','POST',{});await load();message('已切换首页展示');});select.disabled=record.current;
   const exportButton=button('导出',async()=>download(await request('/records/'+record.id),'kronos-'+record.symbol+'-'+record.id+'.json'));
   const remove=button('删除',async()=>{if(!confirm('删除这份历史预测？请先导出需要保留的数据。'))return;await request('/records/'+record.id,'DELETE');await load();message('记录已删除');});remove.disabled=record.current;actions.append(select,exportButton,remove);tr.append(actions);tbody.append(tr);}
  if(!data.history.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='暂无预测，可导入结果文件或先运行 GitHub 预测任务。';tr.append(td);tbody.append(tr);}
  if(data.issues?.length)message('部分随代码发布的记录未能载入，请检查数据文件。',true);else message('已加载 '+data.history.length+' 条预测记录');
 }
 form.oninput=()=>{dirty=true;};window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 form.onsubmit=async event=>{event.preventDefault();const submit=form.querySelector('button[type="submit"]');submit.disabled=true;try{const value={};for(const field of form.elements)if(field.name)value[field.name]=field.type==='checkbox'?field.checked:field.name==='defaultPaths'?Number(field.value):field.value;await request('/settings','PUT',value);dirty=false;message('设置已保存，刷新前台即可查看；请导出备份保留改动。');}catch(e){message(e.message,true);}finally{submit.disabled=false;}};
 $('#reload').onclick=async()=>{if(dirty&&!confirm('有未保存设置，是否放弃并刷新？'))return;try{await load();}catch(e){message(e.message,true);}};
 $('#export-backup').onclick=async()=>{try{download(await request('/backup'),'kronos-backup-'+new Date().toISOString().slice(0,10)+'.json');message('备份已下载，请妥善保存。');}catch(e){message(e.message,true);}};
 async function importFile(input,route,maxBytes,question){const file=input.files?.[0];if(!file)return;input.disabled=true;try{if(file.size>maxBytes)throw Error('文件过大');const value=JSON.parse(await file.text());if(route==='/backup'){value.restoreMode=$('#restore-replace').checked?'replace':'merge';if(value.restoreMode==='replace')question='确认完整替换此模块的当前设置和历史？请先导出当前备份。';}if(!confirm(question))return;await request(route,'POST',value);await load();message('导入成功，请导出一份更新后的备份。');}catch(e){message(e.message,true);}finally{input.value='';input.disabled=false;}}
 $('#import-forecast').onchange=event=>importFile(event.target,'/forecast',512*1024,'确认导入并允许前台公开查看？开启自动最新时可能切换展示记录。');
 $('#import-backup').onchange=event=>importFile(event.target,'/backup',16*1024*1024,'确认合并备份中的历史，并应用备份中的设置？请先导出当前备份。');
 load().catch(e=>message(e.message,true));
})();
