'use strict';
(()=>{
  const $=s=>document.querySelector(s),form=$('#generate-form'),submit=$('#generate-submit'),message=$('#generate-status'),link=$('#generate-task-link');
  const storageKey='kronos-current-task';let timer=null,started=0,configured=false,busy=false,errors=0;
  function saveTask(id){try{if(id)sessionStorage.setItem(storageKey,id);else sessionStorage.removeItem(storageKey);}catch{}}
  function savedTask(){try{return sessionStorage.getItem(storageKey);}catch{return null;}}
  function enabled(){submit.disabled=!configured||busy;submit.textContent=busy?'任务进行中…':'生成未来 24 根预测';}
  function finish(){busy=false;clearTimeout(timer);saveTask(null);enabled();}
  function taskLink(url){if(typeof url==='string'&&/^https:\/\/github\.com\/tholiz888-sudo\/hjs\/actions\/runs\/\d+$/.test(url)){link.href=url;link.hidden=false;}}
  async function json(response){let data;try{data=await response.json();}catch{throw Error('生成服务暂时不可用，请稍后重试。');}if(!response.ok)throw Error(data.error||'请求未成功。');return data;}
  async function poll(id){
    if(Date.now()-started>25*60*1000){message.textContent='等待时间较长，请查看任务详情确认结果；也可刷新页面查看已发布预测。';finish();return;}
    try{
      const data=await json(await fetch('/kronos/api/tasks/'+encodeURIComponent(id),{cache:'no-store'}));errors=0;message.textContent=data.message;taskLink(data.run_url);
      if(data.state==='completed'){
        window.dispatchEvent(new CustomEvent('kronos:forecast',{detail:data.result}));finish();return;
      }
      if(data.state==='failed'){finish();return;}
    }catch(error){errors++;message.textContent=error.message+(errors<6?' 正在等待连接恢复…':' 请查看任务详情或稍后刷新。');if(errors>=6){finish();return;}}
    timer=setTimeout(()=>poll(id),10000);
  }
  $('#generate-interval').onchange=()=>{const range={'15m':'6 小时','1h':'24 小时','4h':'4 天','1d':'24 天'};$('#generate-preview').textContent='预测未来 24 根，约 '+range[$('#generate-interval').value]+'。';};
  form.onsubmit=async event=>{
    event.preventDefault();if(!configured||busy)return;
    const key=$('#generate-key').value;if(!key){message.textContent='请输入维护者设置的生成口令。';$('#generate-key').focus();return;}
    busy=true;enabled();link.hidden=true;message.textContent='正在提交任务…';
    try{
      const data=await json(await fetch('/kronos/api/generate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({symbol:$('#generate-symbol').value,interval:$('#generate-interval').value,paths:Number($('#generate-paths').value)})}));
      $('#generate-key').value='';message.textContent=data.message;saveTask(data.task_id);started=Date.now();errors=0;timer=setTimeout(()=>poll(data.task_id),3000);
    }catch(error){message.textContent=error.message;busy=false;enabled();}
  };
  (async()=>{
    try{const config=await json(await fetch('/kronos/api/config',{cache:'no-store'}));configured=config.configured;message.textContent=configured?'选择参数并输入生成口令。点击生成后会验证连接并提交任务。':'网页生成连接尚未配置，暂可使用右上方备用 GitHub 入口。';enabled();const id=savedTask();if(configured&&id&&/^[0-9a-f-]{36}$/.test(id)){busy=true;started=Date.now();enabled();poll(id);}}
    catch(error){message.textContent=error.message+' 可使用备用 GitHub 入口。';enabled();}
  })();
})();
