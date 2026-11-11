"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Volume2, X } from "lucide-react";
import { useResearch } from "./provider";
import { analyze, displayTime, labels } from "@/lib/engine";
import { advanceSignalAlert, type AlertCursor } from "@/lib/alerts";
import { exchangeNames } from "@/lib/market-types";
import { Button } from "./ui/button";
type Notice = { id: string; title: string; detail: string; test: boolean };
export function SignalAlerts() {
  const { market, marketMode, exchange, symbol, params } = useResearch();
  const [enabled, setEnabled] = useState(true),
    [sound, setSound] = useState(false),
    [system, setSystem] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [message, setMessage] = useState("");
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
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 12000);
    return () => clearTimeout(timer);
  }, [notice]);
  function beep() {
    const context = audio.current;
    if (!context || context.state !== "running") return;
    for (let i = 0; i < 2; i++) {
      const oscillator = context.createOscillator(),
        gain = context.createGain(),
        start = context.currentTime + i * 0.22;
      oscillator.type = "sine";
      oscillator.frequency.value = i ? 740 : 540;
      gain.gain.setValueAtTime(0.04, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    }
  }
  function deliver(item: Notice) {
    setNotice(item);
    setHistory((items) => [item, ...items].slice(0, 10));
    if (!item.test) setTotal((value) => value + 1);
    if (sound) beep();
    if (
      system &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(item.title, { body: item.detail, tag: item.id });
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
      setSound(false);
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
          onClick={() => setEnabled((v) => !v)}
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
        <aside
          role="status"
          data-testid="signal-notice"
          className="fixed bottom-5 right-4 z-50 w-[min(380px,calc(100vw-32px))] rounded-xl border border-primary/40 bg-card p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-primary">
              {notice.title}
            </h2>
            <button aria-label="关闭信号提醒" onClick={() => setNotice(null)}>
              <X size={15} />
            </button>
          </div>
          <p className="mt-3 text-xs leading-6 text-muted">{notice.detail}</p>
        </aside>
      )}
    </section>
  );
}
