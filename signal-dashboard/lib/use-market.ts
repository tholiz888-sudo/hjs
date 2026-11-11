"use client";
import { useEffect, useState } from "react";
import {
  decodeBinanceKlines,
  MAX_MARKET_AGE_MS,
  MARKET_POLL_MS,
  type MarketSnapshot,
  type MarketSymbol,
} from "./binance";

export function readMarketSnapshot(
  body: unknown,
  symbol: MarketSymbol,
): MarketSnapshot {
  const data = body as MarketSnapshot;
  if (
    !data ||
    data.source !== "binance" ||
    data.symbol !== symbol ||
    data.interval !== "1m" ||
    !Array.isArray(data.candles) ||
    !Number.isFinite(data.ageMs) ||
    data.ageMs < 0 ||
    data.ageMs > MAX_MARKET_AGE_MS ||
    !Number.isFinite(data.fetchedAt)
  )
    throw new Error("行情数据格式或时效无效，实时信号已暂停");
  const candles = decodeBinanceKlines(
    data.candles.map((r) => [
      Date.parse(r.datetime),
      r.open,
      r.high,
      r.low,
      r.close,
      r.volume,
      Date.parse(r.datetime) + 59999,
    ]),
    data.serverTime,
  );
  return { ...data, candles };
}
export function useBinanceMarket(symbol: MarketSymbol, enabled: boolean) {
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [state, setState] = useState<{
    snapshot: MarketSnapshot | null;
    receivedAt: number;
    error: string | null;
    loading: boolean;
    retryAt: number;
  }>({
    snapshot: null,
    receivedAt: 0,
    error: null,
    loading: false,
    retryAt: 0,
  });
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setState((previous) =>
      previous.snapshot?.symbol === symbol
        ? { ...previous, loading: true }
        : {
            snapshot: null,
            receivedAt: 0,
            error: null,
            loading: true,
            retryAt: 0,
          },
    );
    async function load() {
      if (!active) return;
      let delay = MARKET_POLL_MS;
      setState((previous) => ({ ...previous, loading: true }));
      try {
        const response = await fetch(`/api/market?symbol=${symbol}`, {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(12_000),
          ]),
        });
        const body = await response.json();
        if (!response.ok) {
          const retry = Number(response.headers.get("Retry-After"));
          if (Number.isFinite(retry) && retry > 0)
            delay = Math.max(delay, Math.min(retry, 3600) * 1000);
          throw new Error(
            typeof body.error === "string" ? body.error : "行情服务暂时不可用",
          );
        }
        const snapshot = readMarketSnapshot(body, symbol);
        if (active) {
          const receivedAt = Date.now();
          setNow(receivedAt);
          setState({
            snapshot,
            receivedAt,
            error: null,
            loading: false,
            retryAt: 0,
          });
        }
      } catch (error) {
        if (active)
          setState((previous) => ({
            ...previous,
            loading: false,
            error:
              error instanceof DOMException && error.name === "TimeoutError"
                ? "行情请求超时，实时信号已暂停"
                : error instanceof TypeError
                  ? "无法连接行情服务，实时信号已暂停"
                  : error instanceof Error
                    ? error.message
                    : "行情连接失败，实时信号已暂停",
            retryAt: Date.now() + delay,
          }));
      } finally {
        if (active) timer = setTimeout(load, delay);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [symbol, enabled, revision]);
  const snapshot = state.snapshot?.symbol === symbol ? state.snapshot : null;
  const ageMs = snapshot
    ? snapshot.ageMs + Math.max(0, Math.max(now, Date.now()) - state.receivedAt)
    : Infinity;
  const healthy =
    enabled && !!snapshot && !state.error && ageMs <= MAX_MARKET_AGE_MS;
  return {
    snapshot,
    healthy,
    ageMs,
    loading: state.loading,
    error: state.error,
    receivedAt: snapshot ? state.receivedAt : 0,
    retrySeconds: Math.max(0, Math.ceil((state.retryAt - now) / 1000)),
    refresh: () => {
      if (Date.now() >= state.retryAt) setRevision((n) => n + 1);
    },
  };
}
