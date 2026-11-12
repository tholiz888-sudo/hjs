"use client";
import {signalOutcome,outcomeLabels} from "@/lib/signal-outcome";
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
  type Candle,
  ema,
} from "@/lib/engine";
import {
  TIMEFRAMES,
  intervalLabel,
  isCandleInterval,
  exchangeNames,
} from "@/lib/market-types";
import { simulatedChartRows } from "@/lib/chart-data";
import { price, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketControls } from "@/components/market-controls";
import { PriceChart } from "@/components/charts";
export default function Dashboard() {
  const { rows: simulatedRows, marketMode, market, exchange } = useResearch();
  const rows =
    marketMode === "live" ? (market.snapshot?.candles ?? []) : simulatedRows;
  if (!rows.length)
    return (
      <>
        <section className="section-heading">
          <div>
            <div className="eyebrow">MARKET / 交易所公开行情</div>
            <h1 className="page-title">10 分钟方向研究</h1>
            <p className="page-desc">
              选择 BTC 或 ETH，使用真实已收盘 K 线计算研究信号。
            </p>
          </div>
        </section>
        <MarketControls />
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-3xl text-muted">
              {market.loading ? "正在加载行情" : "实时信号暂停"}
            </h2>
            <p className="mt-4 text-xs text-muted">
              尚无可验证的交易所行情，不显示价格、方向建议或胜率。可等待自动重试，或明确选择模拟数据练习。
            </p>
          </CardContent>
        </Card>
      </>
    );
  return <DashboardContent rows={rows} />;
}
function DashboardContent({ rows }: { rows: Candle[] }) {
  const {
    params,
    regenerate,
    marketMode,
    symbol,
    market,
    exchange,
    chartInterval,
    setChartInterval,
    chartMarket,
  } = useResearch();
  const exchangeName = exchangeNames[exchange];
  const live = marketMode === "live";
  const paused = live && !market.healthy;
  const sourceLabel = live ? `${exchangeName}行情 · 研究用途` : "模拟数据";
  const [range, setRange] = useState(60);
  const [showEma, setShowEma] = useState(true);
  const [notice, setNotice] = useState("");
  const signals = useMemo(() => analyze(rows, params), [rows, params]);
  const stats = useMemo(() => backtest(rows, params), [rows, params]);
  const latest = signals[signals.length - 1];
  const current = paused
    ? { ...latest, direction: "neutral" as const, filters: [] }
    : latest;
  const lastSignalTime = latest.time;
  const last = rows[rows.length - 1],
    prior = rows[rows.length - 61];
  const change = (last.close / prior.close - 1) * 100;
  const recent = signals
    .map((s, i) => ({ ...s, index: i }))
    .filter((s) => s.direction !== "neutral")
    .slice(-20)
    .reverse()
    .map(s=>({...s,outcome:signalOutcome(rows,s.index,s.direction)}));
  const selectedMarket = chartInterval === "1m" ? market : chartMarket;
  const chartRows = live
    ? (selectedMarket.snapshot?.candles ?? [])
    : simulatedChartRows(rows, chartInterval);
  const chartFast = ema(
      chartRows.map((r) => r.close),
      params.fast,
    ),
    chartSlow = ema(
      chartRows.map((r) => r.close),
      params.slow,
    );
  const visibleRows = chartRows.slice(-range);
  const chart = visibleRows.map((r, i) => ({
    ...r,
    time: r.datetime,
    price: r.close,
    fast: chartFast[chartRows.length - visibleRows.length + i],
    slow: chartSlow[chartRows.length - visibleRows.length + i],
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
          {
            source: sourceLabel,
            symbol: live ? symbol : "SIMULATED_BTCUSDT",
            paused,
            params,
            signal: paused ? null : current,
          },
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
    setNotice("研究信号快照已导出");
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
      <MarketControls />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f8a63c] text-lg font-bold text-[#3b2205]">
            {live && symbol === "ETHUSDT" ? "Ξ" : "₿"}
          </div>
          <span className="font-semibold tracking-wide">
            {live ? symbol.replace("USDT", "") : "BTC"}{" "}
            <span className="text-muted">/ USDT</span>
          </span>
          <Badge>{sourceLabel}</Badge>
          <span className="hidden text-[11px] text-muted sm:inline">
            1 分钟 K 线 · 10 分钟观察窗
          </span>
        </div>
        <span className="flex items-center gap-2 text-[10px] text-muted">
          <Clock3 size={12} />
          {live ? "最近收盘" : "样本时间"}{" "}
          {displayDate(live ? lastSignalTime : last.datetime)}{" "}
          {displayTime(live ? lastSignalTime : last.datetime)} UTC+8
        </span>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: live ? `${exchangeName}最近收盘价` : "最新模拟价格",
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
                <span className="data-label">
                  {live ? "研究用途" : "模拟数据"}
                </span>
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
                  <CardTitle>{intervalLabel(chartInterval)} K 线</CardTitle>
                  <Badge>{sourceLabel}</Badge>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted">
                  K 线周期
                  <select
                    aria-label="K线周期"
                    value={chartInterval}
                    onChange={(e) => {
                      if (isCandleInterval(e.target.value))
                        setChartInterval(e.target.value);
                    }}
                    className="h-8 rounded-lg border border-border bg-background px-2 text-foreground"
                  >
                    {TIMEFRAMES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
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
                      {`${n} 根`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-2xl font-medium tabular-nums">
                  {chartRows.length ? price(chartRows.at(-1)!.close) : "—"}
                </span>
                <span className="text-[10px] text-muted">USDT</span>
                <span className="text-[10px] text-muted">
                  所选周期最近收盘价
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="mb-3 px-3 text-[10px] leading-5 text-muted">
                图表周期可独立切换；信号始终使用 1 分钟触发、5 分钟趋势和 10
                分钟观察窗。10 分钟 K 线由两根完整的 5 分钟 K 线合成；日线按 UTC
                对齐。
              </p>
              {live && selectedMarket.error && (
                <p role="alert" className="px-3 py-2 text-xs text-negative">
                  图表数据：{selectedMarket.error}
                </p>
              )}
              {live && !selectedMarket.healthy && chart.length > 0 && (
                <p className="px-3 text-xs text-[#d0b888]">
                  当前周期仅显示历史快照，等待更新。
                </p>
              )}
              {chart.length ? (
                <PriceChart
                  data={chart}
                  showEma={showEma}
                  sourceLabel={sourceLabel}
                  interval={chartInterval}
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-xs text-muted">
                  {selectedMarket.loading
                    ? "正在加载所选周期 K 线…"
                    : "该周期暂无有效行情"}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-3">
                <div className="flex gap-4 text-[10px] text-muted">
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-primary" />
                    {live ? `${exchangeName} K 线` : "模拟 K 线"}
                  </span>
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-[#76aee7]" />
                    图表 EMA {params.fast}
                  </span>
                  <span>
                    <i className="mr-1 inline-block h-0.5 w-3 bg-[#a79bd3]" />
                    图表 EMA {params.slow}
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
                    <th>十分钟后价格</th><th>价格变化</th><th>结果</th>
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
                      <td className="text-muted" title={`观察截止：${displayDate(s.outcome.dueAt)} ${displayTime(s.outcome.dueAt)} UTC+8`}>10 分钟</td>
                      <td>{s.outcome.price===null?'—':price(s.outcome.price)}</td>
                      <td className="text-muted">{s.outcome.changePercent===null?'—':`${s.outcome.changePercent>0?'+':''}${s.outcome.changePercent.toFixed(3)}%`}</td>
                      <td><span data-testid="signal-outcome" className={cn('rounded px-2 py-1 text-[10px] font-semibold',s.outcome.status==='success'?'bg-positive/10 text-positive':s.outcome.status==='failure'?'bg-negative/10 text-negative':'bg-white/5 text-muted')}>{outcomeLabels[s.outcome.status]}</span></td>
                    </tr>
                  ))}
                  {!recent.length && (
                    <tr>
                      <td colSpan={9} className="text-center text-muted">
                        当前参数下暂无触发信号，可以前往规则页调整参数。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-[9px] text-muted">
              {live
                ? `仅展示${exchangeName}历史已收盘数据触发的研究信号；连接异常时保留历史快照，不代表当前可交易。`
                : "仅展示收盘时触发的历史模拟信号，不代表实际成交或未来收益。"} 成功／失败按信号参考价与整十分钟后的 1 分钟 K 线收盘价比较：看涨后更高、看跌后更低为成功；同价持平，未到期观察中，缺少对应行情不判定。不代表真实成交或事件合约结算收益，口径与回测的下一根开盘入场不同。
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
                <Badge className="border-0 bg-white/5">
                  {paused ? "暂停" : sourceLabel}
                </Badge>
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
                    {paused ? "暂停" : labels[current.direction]}
                  </div>
                  <div className="mt-1 text-[9px] tracking-[.18em]">
                    {paused
                      ? "DATA UNAVAILABLE"
                      : current.direction === "neutral"
                        ? "WAIT FOR CONFIRMATION"
                        : current.direction === "bullish"
                          ? "BULLISH SIGNAL"
                          : "BEARISH SIGNAL"}
                  </div>
                </div>
              </div>
              <p className="text-[11px] leading-6 text-muted">
                {paused
                  ? "行情连接异常或数据已过期，暂停当前研究信号。下方图表仅为最后成功获取的历史数据。"
                  : current.direction === "neutral"
                    ? "过滤条件尚未全部满足，等待趋势与交叉形成共振。保持观望也是研究的一部分。"
                    : params.trendEnabled
                      ? "趋势方向与均线交叉一致，RSI 和成交量过滤均已通过。下一根开盘起观察 10 分钟。"
                      : "趋势过滤已关闭；均线交叉、RSI 和成交量过滤通过。下一根开盘起观察 10 分钟。"}
              </p>
              <div className="my-5 border-t border-border" />
              <div className="mb-4 flex justify-between text-[10px]">
                <span className="text-muted">
                  过滤条件{live ? ` · 收盘 ${displayTime(lastSignalTime)}` : ""}
                </span>
                <span>
                  {
                    current.filters.filter((f) => f.enabled !== false && f.pass)
                      .length
                  }{" "}
                  / {current.filters.filter((f) => f.enabled !== false).length}{" "}
                  {paused ? "信号已暂停" : "已满足"}
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
                disabled={live && (market.loading || market.retrySeconds > 0)}
                onClick={() => {
                  if (live) market.refresh();
                  else {
                    regenerate();
                    setNotice("已重新生成一组模拟行情，并重新计算信号");
                  }
                }}
              >
                <RefreshCw size={13} />
                {live ? "刷新交易所行情" : "重新生成模拟行情"}
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
