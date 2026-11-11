import { NextRequest, NextResponse } from "next/server";
import {
  fetchBinanceMarket,
  isMarketSymbol,
  MarketError,
  maxAgeForInterval,
  intervalMs,
  isExchange,
  isCandleInterval,
  type Exchange,
  type MarketSymbol,
} from "@/lib/binance";
import { fetchOkxMarket } from "@/lib/okx";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Snapshot = Awaited<ReturnType<typeof fetchBinanceMarket>>;
// Bounded to 2 exchanges × 2 symbols × 10 intervals; no arbitrary upstream URLs.
const exchangeCooldown = new Map<
  Exchange,
  { until: number; error: MarketError }
>();
const cache = new Map<
  string,
  {
    data?: Snapshot;
    pending?: Promise<Snapshot>;
    blockedUntil?: number;
    error?: MarketError;
  }
>();
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "BTCUSDT";
  if (!isMarketSymbol(symbol))
    return NextResponse.json(
      { error: "仅支持 BTCUSDT 和 ETHUSDT" },
      { status: 400 },
    );
  const exchange = request.nextUrl.searchParams.get("exchange") ?? "binance";
  const interval = request.nextUrl.searchParams.get("interval") ?? "1m";
  if (!isExchange(exchange) || !isCandleInterval(interval))
    return NextResponse.json(
      { error: "不支持的交易所或 K 线周期" },
      { status: 400 },
    );
  const key = `${exchange}:${symbol}:${interval}`;
  const entry = cache.get(key) ?? {};
  cache.set(key, entry);
  try {
    const cooldown = exchangeCooldown.get(exchange);
    if (cooldown && cooldown.until > Date.now())
      throw new MarketError(
        cooldown.error.message,
        429,
        Math.ceil((cooldown.until - Date.now()) / 1000),
      );
    if (entry.blockedUntil && entry.blockedUntil > Date.now())
      throw new MarketError(
        entry.error?.message ?? "请稍后重试",
        entry.error?.status ?? 503,
        Math.ceil((entry.blockedUntil - Date.now()) / 1000),
      );
    let data = entry.data;
    if (!data || Date.now() - data.fetchedAt >= 10_000) {
      entry.pending ??=
        exchange === "okx"
          ? fetchOkxMarket(symbol, fetch, interval)
          : fetchBinanceMarket(symbol, fetch, interval);
      try {
        data = await entry.pending;
        entry.data = data;
      } finally {
        entry.pending = undefined;
      }
    }
    const lastClosedAt =
      Date.parse(data.candles[data.candles.length - 1].datetime) +
      intervalMs(interval);
    const ageMs =
      data.serverTime - lastClosedAt + Math.max(0, Date.now() - data.fetchedAt);
    if (ageMs > maxAgeForInterval(interval))
      throw new MarketError("行情已过期，暂停研究信号");
    return NextResponse.json(
      { ...data, ageMs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const failure =
      error instanceof MarketError
        ? error
        : new MarketError("行情暂时不可用，实时信号已暂停");
    if (failure.status === 429)
      exchangeCooldown.set(exchange, {
        until: Date.now() + failure.retryAfter * 1000,
        error: failure,
      });
    entry.data = undefined;
    entry.error = failure;
    entry.blockedUntil = Date.now() + failure.retryAfter * 1000;
    return NextResponse.json(
      { error: failure.message },
      {
        status: failure.status,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(failure.retryAfter),
        },
      },
    );
  }
}
