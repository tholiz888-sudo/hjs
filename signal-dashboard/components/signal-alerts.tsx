"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Volume2, X } from "lucide-react";
import { useResearch } from "./provider";
import { analyze, displayTime, labels } from "@/lib/engine";
import { advanceSignalAlert, type AlertCursor } from "@/lib/alerts";
import { exchangeNames } from "@/lib/market-types";
import { Button } from "./ui/button";
type Notice = { id: string; title: string; detail: string; test: boolean; raisedAt?:number };
export function SignalAlerts() {
  const { market, marketMode, exchange, symbol, params } = useResearch();
  const [enabled, setEnabled] = useState(true),
    [sound, setSound] = useState(false),
    [system, setSystem] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [message, setMessage] = useState("");
  const [volume,setVolume]=useState(65),[repeat,setRepeat]=useState(true),[mutedNotice,setMutedNotice]=useState("");
  const dialog=useRef<HTMLDialogElement|null>(null);
  const tones=useRef(new Set<OscillatorNode>());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [history, setHistory] = useState<Notice[]>([]);
  const [total, setTotal] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const cursor = useRef<AlertCursor | null>(null);
  const signals = useMemo(
    () => (market.snapshot ? analyze(market.snapshot.candles, params) : []),
    [market.snapshot, params],
  );
  useEffect(() => {
    setPermission(
      "Notification" in window ? Notification.permission : "unsupported",
    );
    return () => {
      void audio.current?.close().catch(() => {});
    };
  }, []);
  function stopAlarm(){for(const oscillator of tones.current){try{oscillator.stop()}catch{}}tones.current.clear();}
  function acknowledge(){stopAlarm();setNotice(null);}
  useEffect(()=>{
    if(!notice)return;
    if(dialog.current&&!dialog.current.open)dialog.current.showModal();
  },[notice]);
  useEffect(()=>{
    if(!notice||!sound||mutedNotice===notice.id)return;
    const started=notice.raisedAt??Date.now();
    if(!notice.test&&Date.now()-started>=60_000)return;
    beep();
    if(!repeat||notice.test)return()=>stopAlarm();
    const timer=setInterval(()=>{if(Date.now()-started>=60_000){clearInterval(timer);return;}beep();},7000);
    return()=>{clearInterval(timer);stopAlarm()};
  },[notice,sound,repeat,volume,mutedNotice]);
  function beep() {
    stopAlarm();
    const context = audio.current;
    if (!context || context.state !== "running" || volume===0) return;
    for (let i = 0; i < 6; i++) {
      const oscillator = context.createOscillator(),
        gain = context.createGain(),
        start = context.currentTime + i * 0.27;
      oscillator.type = "triangle";
      oscillator.frequency.value = [660,880,660][i%3];
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.28*volume/100,start+0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain);gain.connect(context.destination);
      tones.current.add(oscillator);oscillator.onended=()=>{tones.current.delete(oscillator);oscillator.disconnect();gain.disconnect()};
      oscillator.start(start);oscillator.stop(start + 0.24);
    }
  }
  function deliver(item: Notice) {
    setNotice({...item,raisedAt:Date.now()});
    setHistory((items) => [item, ...items].slice(0, 10));
    if (!item.test) setTotal((value) => value + 1);

    if (
      system &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        const notification=new Notification(item.title, { body: item.detail, tag: item.id, requireInteraction:true });
        notification.onclick=()=>{window.focus();notification.close()};
      } catch {
        setMessage("当前浏览器不支持此类系统通知，仍会显示页面提醒。");
      }
    }
  }
  useEffect(() => {
    if (!enabled) {
      cursor.current = null;
      return;
    }
    if (marketMode !== "live") {
      cursor.current = null;
      return;
    }
    if (!market.healthy || !signals.length) return;
    const latest = signals.at(-1)!;
    const stream = `${exchange}:${symbol}:${JSON.stringify(params)}`;
    const result = advanceSignalAlert(cursor.current, stream, latest);
    cursor.current = result.cursor;
    if (result.notify) {
      const row = market.snapshot!.candles.at(-1)!;
      deliver({
        id: `${stream}:${latest.time}:${latest.direction}`,
        title: `${exchangeNames[exchange]} ${symbol.replace("USDT", "/USDT")} · ${labels[latest.direction]}研究信号`,
        detail: `${displayTime(latest.time)} 收盘确认 · 参考价 ${row.close.toFixed(2)} USDT · 观察 10 分钟，仅供研究。`,
        test: false,
      });
    }
  }, [enabled, marketMode, market.healthy, signals, exchange, symbol, params]);
  async function toggleSound() {
    if (sound) {
      stopAlarm();setSound(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      if (audio.current.state !== "running") throw Error();
      setSound(true);
      beep();
      setMessage("声音已开启；请保持页面运行，浏览器可能限制后台声音。");
    } catch {
      setMessage("当前浏览器未允许声音，页面文字提醒仍然可用。");
    }
  }
  async function toggleSystem() {
    if (system) {
      setSystem(false);
      return;
    }
    if (!("Notification" in window)) {
      setMessage("当前浏览器不支持系统通知，仍可使用页面提醒。");
      return;
    }
    try {
      const status = await Notification.requestPermission();
      setPermission(status);
      setSystem(status === "granted");
      setMessage(
        status === "granted"
          ? "系统通知已开启；浏览器关闭或设备休眠后无法保证提醒。"
          : "系统通知未获许可，可在浏览器站点设置中修改；页面提醒仍可用。",
      );
    } catch {
      setMessage("无法开启系统通知，页面提醒仍可用。");
    }
  }
  return (
    <section
      aria-label="信号提醒设置"
      className="mb-5 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 flex items-center gap-2 text-xs">
          <Bell size={14} className="text-primary" />
          新信号提醒
        </span>
        <Button
          variant={enabled ? "default" : "outline"}
          size="sm"
          aria-pressed={enabled}
          onClick={() => {if(enabled)acknowledge();setEnabled((v) => !v)}}
        >
          {enabled ? "页面提醒已开" : "页面提醒已关"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={sound}
          disabled={!enabled}
          onClick={toggleSound}
        >
          <Volume2 size={12} />
          {sound ? "声音已开" : "开启声音"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={system}
          disabled={!enabled || permission === "unsupported"}
          onClick={toggleSystem}
        >
          {system ? "系统通知已开" : "开启系统通知"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!enabled}
          onClick={() =>
            deliver({
              id: `test:${Date.now()}`,
              title: "测试提醒",
              detail: "这是一条提醒测试，不代表产生了行情信号。",
              test: true,
            })
          }
        >
          测试提醒
        </Button>
        <span className="text-[10px] text-muted" data-testid="alert-count">
          本页会话 {total} 条新信号
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        <label className="flex items-center gap-2">提醒音量 <input aria-label="提醒音量" type="range" min="0" max="100" step="5" value={volume} onChange={event=>setVolume(Number(event.target.value))}/><span>{volume}%</span></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={repeat} onChange={event=>setRepeat(event.target.checked)}/>真实信号重复响铃（最多 60 秒）</label>
        <span>弹窗保留至确认；测试提醒只响一轮。</span>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted">
        只提醒连接正常后最新已收盘的 1
        分钟信号；图表周期不影响提醒。首次加载、切换行情源、修改规则及模拟模式不触发历史提醒。请保持网页运行，浏览器关闭后不提供后台推送。
      </p>
      {message && <p className="mt-2 text-[10px] text-muted">{message}</p>}
      {history.length > 0 && (
        <details className="mt-3 text-[10px] text-muted">
          <summary className="cursor-pointer">最近提醒（最多 10 条）</summary>
          <ul className="mt-2 space-y-2">
            {history.map((item) => (
              <li key={item.id} className="rounded border border-border p-2">
                <span className="text-foreground">{item.title}</span>
                <p className="mt-1 leading-5">{item.detail}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
      {notice && (
        <dialog ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby="signal-alert-title" aria-describedby="signal-alert-detail" data-testid="signal-notice" className="signal-alert-dialog" onCancel={event=>{event.preventDefault();acknowledge()}}>
          <div className="signal-alert-heading"><span className="signal-alert-icon"><Bell size={28}/></span><span>{notice.test?'提醒效果测试':'新信号 · 请查看'}</span><button aria-label="关闭信号提醒" onClick={acknowledge}><X size={22}/></button></div>
          <h2 id="signal-alert-title">{notice.title}</h2>
          <p id="signal-alert-detail">{notice.detail}</p>
          <p className="signal-alert-hint">{notice.test?'测试不会计入新信号数量。':sound&&repeat?'每 7 秒重复一轮，最多 60 秒；确认或停止响铃后结束。':'请核对信号时间和行情，确认后关闭。'}</p>
          <div className="signal-alert-actions"><Button variant="outline" disabled={!sound||mutedNotice===notice.id} onClick={()=>{stopAlarm();setMutedNotice(notice.id)}}>停止响铃</Button><Button autoFocus onClick={acknowledge}>我已看到</Button></div>
        </dialog>
      )}
    </section>
  );
}
