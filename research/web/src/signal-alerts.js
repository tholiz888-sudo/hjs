import {esc,button} from './ui.js';
const key='jiange-signal-watch-v1',freshMs=600000;
export function createSignalAlerts({storage=globalThis.localStorage,now=Date.now,toast=()=>{},NotificationImpl=globalThis.Notification,audioFactory=()=>new(globalThis.AudioContext||globalThis.webkitAudioContext)()}={}){
 let seen=new Map(),unread=new Map(),prefs={sound:false,desktop:false},audio=null,deliveryError='';const initialized=new Set();
 function read(){try{const s=JSON.parse(storage?.getItem(key)||'null');if(s){seen=new Map(s.seen||[]);unread=new Map(s.unread||[]);prefs={...prefs,...s.prefs}}}catch{}}
 function save(){const recent=map=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,5000);try{storage?.setItem(key,JSON.stringify({seen:recent(seen),unread:recent(unread),prefs}))}catch{}}
 read();
 const isNew=row=>!!(row.signalId&&unread.has(row.signalId)&&now()-unread.get(row.signalId)<freshMs);
 function beep(){if(!prefs.sound||audio?.state!=='running')return false;try{const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=880;gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.6);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.6);return true}catch{return false}}
 function observe(all,matched,{source,kind}){read();const namespace=source+':'+kind,first=!initialized.has(namespace),eligible=new Set(matched.map(r=>r.signalId)),alerts=[];let changed=false;
  for(const row of all){if(!row.signalId||seen.has(row.signalId))continue;seen.set(row.signalId,now());changed=true;const time=Date.parse(row.detectedAt),fresh=Number.isFinite(time)&&time<=now()+1500&&now()-time<=freshMs;
   if(!first&&row.alertable===true&&fresh){unread.set(row.signalId,time);if(eligible.has(row.signalId))alerts.push(row)}
  }initialized.add(namespace);if(changed)save();
  if(alerts.length){const names=alerts.slice(0,3).map(r=>r.symbol).join('、'),message=`新增 ${alerts.length} 条信号：${names}${alerts.length>3?'等':''}。请核对确认时间、发现时间及价格。`;toast(message);if(prefs.sound&&!beep()){deliveryError='声音尚未激活或已被浏览器暂停，请点击测试声音与通知';toast(deliveryError)}
   if(prefs.desktop)notify(message,alerts[0].signalId);
  }return alerts;
 }
 function notify(message,tag){if(NotificationImpl?.permission!=='granted'){deliveryError='桌面通知未获授权，请在浏览器网站设置中允许通知';toast(deliveryError);return false}try{new NotificationImpl('投研看剑 · 新信号',{body:message,tag});return true}catch{deliveryError='桌面通知发送失败，请检查浏览器及系统通知设置；移动浏览器可能不支持此方式';toast(deliveryError);return false}}
 async function enableSound(){try{audio??=audioFactory();await audio.resume();prefs.sound=audio.state==='running';save();if(prefs.sound&&beep())return true;deliveryError='浏览器未允许声音，请点击测试按钮，并检查标签页是否静音';toast(deliveryError);return false}catch{prefs.sound=false;save();deliveryError='声音启动失败，请检查浏览器声音权限';toast(deliveryError);return false}}
 async function toggleSound(){deliveryError='';if(prefs.sound&&audio?.state==='running'){prefs.sound=false;save();return false}return enableSound()}
 async function toggleDesktop(){deliveryError='';if(!NotificationImpl||globalThis.isSecureContext===false){toast('桌面通知需要支持通知的浏览器，并通过 HTTPS 或 localhost 打开');return false}if(prefs.desktop&&NotificationImpl.permission==='granted'){prefs.desktop=false;save();return false}try{const permission=await NotificationImpl.requestPermission();prefs.desktop=permission==='granted';save();if(!prefs.desktop){deliveryError=permission==='denied'?'通知已被浏览器阻止，请点击地址栏的网站设置，将通知改为允许':'尚未允许桌面通知，请在授权提示中选择允许';toast(deliveryError)}return prefs.desktop}catch{deliveryError='无法申请通知权限，请检查浏览器网站设置';toast(deliveryError);return false}}
 async function testDelivery(){deliveryError='';const sound=await enableSound();let desktop=false;if(prefs.desktop)desktop=notify('这是一条测试通知，用于确认提醒通道，不代表出现交易信号。','signal-watch-test');if(sound&&!deliveryError)toast(desktop?'测试已播放声音并发送桌面通知；若未弹出，请检查系统勿扰模式和浏览器通知设置':'已播放测试声音；桌面通知未开启，请先点击开启桌面通知');return{sound,desktop}}
 function panel({live,status,rows}){if(!live)return '<section class="signal-watch"><b>当前为历史快照，不产生新信号提醒。</b></section>';const rt=status?.realtime;
  const label=rt?.connected&&!rt.error?'OKX实时K线已连接':rt?.enabled?(rt.error||'OKX实时K线连接中，后台扫描继续'):'当前使用后台扫描';
  return `<section class="signal-watch"><div class="row between wrap"><b>新信号提醒 · ${rows.filter(isNew).length} 条未读</b><div class="row wrap">${button('signal-sound',prefs.sound&&audio?.state==='running'?'关闭声音提醒':'开启声音提醒','small')}${button('signal-desktop',prefs.desktop&&NotificationImpl?.permission==='granted'?'关闭桌面通知':'开启桌面通知','small')}${button('signal-test','测试声音与通知','small')}${button('signal-ack','标为已读','small')}</div></div><p role="status">${esc(deliveryError||`声音：${prefs.sound?(audio?.state==='running'?'已开启':'需点击开启或测试重新激活'):'未开启'}；桌面通知：${prefs.desktop&&NotificationImpl?.permission==='granted'?'已授权（可点击测试确认系统显示）':NotificationImpl?.permission==='denied'?'已被浏览器阻止':'未开启'}`)}</p><p>只提醒当前分类及筛选条件中新出现的信号；首次加载、历史补采不报警。提醒需保持页面打开，浏览器休眠可能延迟。</p><small>${esc(label)}${rt?.enabled?' · 已预热 '+Number(rt.symbols||0)+' 个币种':''}${rt?.pendingRecovery?' · '+Number(rt.pendingRecovery)+' 个币种等待补齐K线':''} · <span data-market-events>正在连接页面实时通道</span></small></section>`
 }
 return{observe,isNew,panel,toggleSound,toggleDesktop,testDelivery,testSound:beep,acknowledge(){unread.clear();save()},active:()=>prefs.sound||prefs.desktop};
}
