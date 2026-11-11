"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  Clock3,
  Download,
  Layers3,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Minus,
  X,
} from "lucide-react";
import { useResearch } from "@/components/provider";
import {
  analyze,
  backtest,
  displayDate,
  displayTime,
  labels,
  simulate,
} from "@/lib/engine";
import { price, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceChart } from "@/components/charts";
export default function Dashboard() {
  const { params, rows, regenerate } = useResearch();
  const [range, setRange] = useState(60);
  const [showEma, setShowEma] = useState(true);
  const [notice, setNotice] = useState("");
  const signals = useMemo(() => analyze(rows, params), [rows, params]);
  const stats = useMemo(() => backtest(rows, params), [rows, params]);
  const current = signals[signals.length - 1],
    last = rows[rows.length - 1],
    prior = rows[rows.length - 61];
  const change = (last.close / prior.close - 1) * 100;
  const recent = signals
    .map((s, i) => ({ ...s, index: i }))
    .filter((s) => s.direction !== "neutral")
    .slice(-20)
    .reverse();
  const chart = rows.slice(-range).map((r, i) => ({
    time: r.datetime,
    price: r.close,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    fast: signals[rows.length - range + i].fast,
    slow: signals[rows.length - range + i].slow,
  }));
  const Icon =
    current.direction === "bullish"
      ? TrendingUp
      : current.direction === "bearish"
        ? TrendingDown
        : Minus;
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          { source: "模拟数据 · 仅供研究学习", params, signal: current },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "signal-research.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("模拟信号快照已导出");
  }
  return (
    <>
      <section className="section-heading">
        <div>
          <div className="eyebrow">MARKET SIGNAL / 短周期研究</div>
          <h1 className="page-title">
            捕捉趋势，保持理性<span className="text-primary">。</span>
          </h1>
          <p className="page-desc">
            以多重技术指标过滤市场噪声，探索未来 10 分钟的方向假设。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={download}
          className="mt-5 hidden sm:inline-flex"
        >
          <Download size={13} />
          导出快照
        </Button>
      </section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f8a63c] text-lg font-bold text-[#3b2205]">
            ₿
          </div>
          <span className="font-semibold tracking-wide">
            BTC <span className="text-muted">/ USDT</span>
          </span>
          <Badge>模拟市场</Badge>
          <span className="hidden text-[11px] text-muted sm:inline">
            1 分钟 K 线 · 10 分钟观察窗
          </span>
        </div>
        <span className="flex items-center gap-2 text-[10px] text-muted">
          <Clock3 size={12} />
          样本时间 {displayDate(last.datetime)} {displayTime(last.datetime)}{" "}
          UTC+8
        </span>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "最新模拟价格",
            value: `$${price(last.close)}`,
            sub: `近 60 分钟 ${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
            color: change >= 0 ? "text-positive" : "text-negative",
          },
          {
            label: "方向命中率",
            value: stats.total ? `${stats.winRate.toFixed(1)}%` : "—",
            sub: `${stats.total} 次非重叠研究样本`,
            color: "text-muted",
          },
          {
            label: "样本触发信号",
            value: String(
              signals.filter((s) => s.direction !== "neutral").length,
            ).padStart(2, "0"),
            sub: params.trendEnabled
              ? "四项过滤条件共同确认"
              : "趋势过滤关闭 · 三项条件确认",
            color: "text-muted",
          },
          {
            label: "信号观察周期",
            value: "10 分钟",
            sub: "1m 触发 / 5m 趋势过滤",
            color: "text-muted",
          },
        ].map((m, i) => (
          <Card key={m.label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <p className="metric-label">{m.label}</p>
                <span className="data-label">模拟数据</span>
              </div>
              <div className="metric-value">{m.value}</div>
              <div
                className={cn(
                  "mt-3 flex items-center gap-1 text-[10px]",
                  m.color,
                )}
              >
                {i === 0 &&
                  (change >= 0 ? (
                    <ArrowUpRight size={13} />
                  ) : (
                    <ArrowDownRight size={13} />
                  ))}
                {m.sub}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-2 min-w-0 space-y-5 xl:order-1">
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle>1 分钟 K 线</CardTitle>
                  <Badge>模拟数据</Badge>
                </div>
                <div className="flex gap-1 rounded-md bg-background p-1">
                  {[30, 60, 180].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRange(n)}
                      className={cn(
                        "rounded px-3 py-1 text-[10px] text-muted",
                        range === n && "bg-[#283125] text-primary",
                      )}
                    >
                      {n === 180 ? "3 小时" : `${n} 分钟`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-2xl font-medium tabular-nums">
                  {price(last.close)}
                </span>
                <span className="text-[10px] text-muted">USDT</span>
                <span
                  className={cn(
                    "text-[10px]",
                    change >= 0 ? "text-positive" : "text-negative",
                  )}
                >
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <PriceChart data={chart} showEma={showEma} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-3">
                <div className="flex gap-4 text-[10px] text-muted">
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-primary" />
                    模拟 K 线
                  </span>
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-[#76aee7]" />
                    EMA {params.fast}
                  </span>
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-[#a79bd3]" />
                    EMA {params.slow}
                  </span>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[10px] text-muted">
                  <input
                    type="checkbox"
                    checked={showEma}
                    onChange={(e) => setShowEma(e.target.checked)}
                    className="accent-primary"
                  />
                  显示均线
                </label>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle>最近 20 条信号</CardTitle>
                  <Badge>研究用途</Badge>
                </div>
                <Link
                  href="/backtest"
                  className="flex items-center gap-1 text-[10px] text-muted hover:text-primary"
                >
                  查看回测 <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <div className="table-scroll max-h-[390px]">
              <table>
                <thead className="sticky top-0 z-10 bg-card">
                  <tr>
                    <th>触发时间 UTC+8</th>
                    <th>信号方向</th>
                    <th>参考价格</th>
                    <th>RSI ({params.rsi})</th>
                    <th>成交量倍数</th>
                    <th>观察窗</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.time}>
                      <td className="text-muted">
                        {displayDate(s.time)} {displayTime(s.time)}
                      </td>
                      <td className={`signal-${s.direction}`}>
                        <span className="status-dot" />
                        {labels[s.direction]}
                      </td>
                      <td>{price(rows[s.index].close)}</td>
                      <td className="text-muted">{s.rsi.toFixed(1)}</td>
                      <td className="text-muted">
                        {s.volumeRatio.toFixed(2)}×
                      </td>
                      <td className="text-muted">10 分钟</td>
                    </tr>
                  ))}
                  {!recent.length && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted">
                        当前参数下暂无触发信号，可以前往规则页调整参数。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-[9px] text-muted">
              仅展示收盘时触发的历史模拟信号，不代表实际成交或未来收益。
            </p>
          </Card>
        </div>
        <div className="order-1 space-y-5 xl:order-2">
          <Card
            className={cn(
              "overflow-hidden",
              current.direction === "bullish"
                ? "border-[#96dfa940]"
                : current.direction === "bearish"
                  ? "border-[#f2969940]"
                  : "border-[#72809640]",
            )}
          >
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle>当前方向信号</CardTitle>
                <Badge className="border-0 bg-white/5">模拟数据</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "my-5 flex items-center gap-4",
                  `signal-${current.direction}`,
                )}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-current/20 bg-white/[.03]">
                  <Icon size={34} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-[35px] font-semibold tracking-tight">
                    {labels[current.direction]}
                  </div>
                  <div className="mt-1 text-[9px] tracking-[.18em]">
                    {current.direction === "neutral"
                      ? "WAIT FOR CONFIRMATION"
                      : current.direction === "bullish"
                        ? "BULLISH SIGNAL"
                        : "BEARISH SIGNAL"}
                  </div>
                </div>
              </div>
              <p className="text-[11px] leading-6 text-muted">
                {current.direction === "neutral"
                  ? "过滤条件尚未全部满足，等待趋势与交叉形成共振。保持观望也是研究的一部分。"
                  : params.trendEnabled
                    ? "趋势方向与均线交叉一致，RSI 和成交量过滤均已通过。下一根开盘起观察 10 分钟。"
                    : "趋势过滤已关闭；均线交叉、RSI 和成交量过滤通过。下一根开盘起观察 10 分钟。"}
              </p>
              <div className="my-5 border-t border-border" />
              <div className="mb-4 flex justify-between text-[10px]">
                <span className="text-muted">过滤条件</span>
                <span>
                  {
                    current.filters.filter((f) => f.enabled !== false && f.pass)
                      .length
                  }{" "}
                  / {current.filters.filter((f) => f.enabled !== false).length}{" "}
                  已满足
                </span>
              </div>
              <div className="space-y-4">
                {current.filters.map((f) => (
                  <div className="flex items-start gap-2.5" key={f.name}>
                    <span
                      className={cn(
                        "mt-0.5 rounded-full p-0.5",
                        f.enabled !== false && f.pass
                          ? "bg-positive/10 text-positive"
                          : "bg-white/5 text-muted",
                      )}
                    >
                      {f.enabled !== false && f.pass ? (
                        <Check size={11} />
                      ) : (
                        <Minus size={11} />
                      )}
                    </span>
                    <div>
                      <div className="text-[11px]">{f.name}</div>
                      <div className="mt-1 text-[9px] leading-4 text-muted">
                        {f.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                className="mt-6 w-full text-xs"
                onClick={() => {
                  regenerate();
                  setNotice("已重新生成一组模拟行情，并重新计算信号");
                }}
              >
                <RefreshCw size={13} />
                重新生成模拟行情
              </Button>
              <Link
                href="/rules"
                className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted hover:text-primary"
              >
                <Settings2 size={11} />
                调整信号参数 <ArrowRight size={11} />
              </Link>
            </CardContent>
          </Card>
          <Card className="bg-transparent">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-[11px]">
                <ShieldCheck size={15} className="text-primary" />
                研究者须知
              </div>
              <p className="mt-3 text-[10px] leading-6 text-muted">
                信号是对规则的可视化表达，并非确定性预测。模拟回测未计手续费、滑点及杠杆成本。
              </p>
              <div className="mt-4 flex items-center gap-1 text-[9px] text-muted">
                <Layers3 size={11} />
                严格过滤 · 收盘确认 · 无前视数据
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex max-w-[90vw] items-center gap-4 rounded-lg border border-border bg-card p-4 text-xs shadow-xl"
        >
          <Check size={15} className="text-primary" />
          {notice}
          <button aria-label="关闭通知" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
