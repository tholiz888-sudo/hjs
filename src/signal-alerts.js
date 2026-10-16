import {esc,button} from './ui.js';
const key='jiange-signal-watch-v1',freshMs=600000;
export function createSignalAlerts({storage=globalThis.localStorage,now=Date.now,toast=()=>{},NotificationImpl=globalThis.Notification,audioFactory=()=>new(globalThis.AudioContext||globalThis.webkitAudioContext)()}={}){
 let seen=new Map(),unread=new Map(),prefs={sound:false,desktop:false},audio=null;const initialized=new Set();
 function read(){try{const s=JSON.parse(storage?.getItem(key)||'null');if(s){seen=new Map(s.seen||[]);unread=new Map(s.unread||[]);prefs={...prefs,...s.prefs}}}catch{}}
 function save(){const recent=map=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,5000);try{storage?.setItem(key,JSON.stringify({seen:recent(seen),unread:recent(unread),prefs}))}catch{}}
 read();
 const isNew=row=>!!(row.signalId&&unread.has(row.signalId)&&now()-unread.get(row.signalId)<freshMs);
 function beep(){if(!prefs.sound||audio?.state!=='running')return false;try{const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=880;gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.6);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.6);return true}catch{return false}}
 function observe(all,matched,{source,kind}){read();const namespace=source+':'+kind,first=!initialized.has(namespace),eligible=new Set(matched.map(r=>r.signalId)),alerts=[];let changed=false;
  for(const row of all){if(!row.signalId||seen.has(row.signalId))continue;seen.set(row.signalId,now());changed=true;const time=Date.parse(row.detectedAt),fresh=Number.isFinite(time)&&time<=now()+1500&&now()-time<=freshMs;
   if(!first&&row.alertable===true&&fresh){unread.set(row.signalId,time);if(eligible.has(row.signalId))alerts.push(row)}
  }initialized.add(namespace);if(changed)save();
  if(alerts.length){const names=alerts.slice(0,3).map(r=>r.symbol).join('、'),message=`新增 ${alerts.length} 条信号：${names}${alerts.length>3?'等':''}。请核对确认时间、发现时间及价格。`;toast(message);beep();
   if(prefs.desktop&&NotificationImpl?.permission==='granted')try{new NotificationImpl('投研看剑 · 新信号',{body:message,tag:alerts[0].signalId})}catch{}
  }return alerts;
 }
 async function toggleSound(){if(prefs.sound&&audio?.state==='running'){prefs.sound=false;save();return false}try{audio??=audioFactory();await audio.resume();prefs.sound=audio.state==='running';save();if(prefs.sound)beep();else toast('浏览器未允许声音，请保持页面打开并再次点击开启');return prefs.sound}catch{prefs.sound=false;save();toast('当前浏览器不支持声音提醒');return false}}
 async function toggleDesktop(){if(!NotificationImpl){toast('当前浏览器不支持桌面通知');return false}if(prefs.desktop&&NotificationImpl.permission==='granted'){prefs.desktop=false;save();return false}const permission=await NotificationImpl.requestPermission();prefs.desktop=permission==='granted';save();if(!prefs.desktop)toast('未获得桌面通知权限，可继续使用页面标记和声音');return prefs.desktop}
 function panel({live,status,rows}){if(!live)return '<section class="signal-watch"><b>当前为历史快照，不产生新信号提醒。</b></section>';const rt=status?.realtime;
  const label=rt?.connected&&!rt.error?'OKX实时K线已连接':rt?.enabled?(rt.error||'OKX实时K线连接中，后台扫描继续'):'当前使用后台扫描';
  return `<section class="signal-watch"><div class="row between wrap"><b>新信号提醒 · ${rows.filter(isNew).length} 条未读</b><div class="row wrap">${button('signal-sound',prefs.sound&&audio?.state==='running'?'关闭声音提醒':'开启声音提醒','small')}${button('signal-desktop',prefs.desktop&&NotificationImpl?.permission==='granted'?'关闭桌面通知':'开启桌面通知','small')}${button('signal-ack','标为已读','small')}</div></div><p>只提醒当前分类及筛选条件中新出现的信号；首次加载、历史补采不报警。提醒需保持页面打开，浏览器休眠可能延迟。</p><small>${esc(label)}${rt?.enabled?' · 已预热 '+Number(rt.symbols||0)+' 个币种':''}${rt?.pendingRecovery?' · '+Number(rt.pendingRecovery)+' 个币种等待补齐K线':''} · <span data-market-events>正在连接页面实时通道</span></small></section>`
 }
 return{observe,isNew,panel,toggleSound,toggleDesktop,testSound:beep,acknowledge(){unread.clear();save()},active:()=>prefs.sound||prefs.desktop};
}
