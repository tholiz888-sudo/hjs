"use client";
import { RefreshCw } from "lucide-react";
import { useResearch } from "./provider";
import { isMarketSymbol } from "@/lib/binance";
import { Button } from "./ui/button";
export function MarketControls() {
  const { symbol, setSymbol, marketMode, setMarketMode, market } =
    useResearch();
  return (
    <section
      aria-label="行情来源与连接状态"
      className="mb-5 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          交易对
          <select
            aria-label="交易对"
            value={symbol}
            disabled={marketMode === "simulated"}
            onChange={(e) => {
              if (isMarketSymbol(e.target.value)) setSymbol(e.target.value);
            }}
            className="h-9 rounded-lg border border-border bg-background px-3 text-foreground"
          >
            <option value="BTCUSDT">BTC / USDT</option>
            <option value="ETHUSDT">ETH / USDT</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          数据源
          <select
            aria-label="数据源"
            value={marketMode}
            onChange={(e) =>
              setMarketMode(e.target.value === "live" ? "live" : "simulated")
            }
            className="h-9 rounded-lg border border-border bg-background px-3 text-foreground"
          >
            <option value="live">币安实时行情</option>
            <option value="simulated">模拟数据（练习）</option>
          </select>
        </label>
        {marketMode === "live" && (
          <Button
            variant="outline"
            size="sm"
            disabled={market.loading || market.retrySeconds > 0}
            onClick={market.refresh}
          >
            <RefreshCw size={13} />
            {market.retrySeconds > 0
              ? `${market.retrySeconds}s 后重试`
              : market.loading
                ? "连接中…"
                : "刷新行情"}
          </Button>
        )}
        <span
          data-testid="market-status"
          className={`text-[11px] ${marketMode === "live" && !market.healthy ? "text-[#d0b888]" : "text-positive"}`}
        >
          {marketMode === "simulated"
            ? "模拟演示 · 非真实市场"
            : market.healthy
              ? "币安已连接 · 研究用途"
              : market.loading
                ? "正在连接币安，信号暂未启用"
                : "行情不可用 · 实时信号已暂停"}
        </span>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted">
        {marketMode === "simulated"
          ? "此模式仅用于练习；切换至币安实时行情后才会请求真实市场数据。"
          : `每 15 秒检查一次，仅用已收盘的 1 分钟 K 线计算；价格为最近收盘价，不是逐笔报价。${market.receivedAt ? `最近更新 ${new Date(market.receivedAt).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}（UTC+8）。` : ""}`}
      </p>
      {marketMode === "live" && market.error && (
        <p role="alert" className="mt-2 text-xs leading-5 text-negative">
          {market.error}。不会自动改用模拟数据。
        </p>
      )}
      {marketMode === "live" &&
        market.snapshot &&
        !market.error &&
        !market.healthy &&
        !market.loading && (
          <p role="alert" className="mt-2 text-xs text-negative">
            行情超过 2 分钟未更新，实时信号已暂停。
          </p>
        )}
    </section>
  );
}
