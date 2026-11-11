import { NextRequest, NextResponse } from "next/server";
import {
  fetchBinanceMarket,
  isMarketSymbol,
  MarketError,
  MAX_MARKET_AGE_MS,
  type MarketSymbol,
} from "@/lib/binance";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Snapshot = Awaited<ReturnType<typeof fetchBinanceMarket>>;
// Per-process, bounded to two symbols; coalesce concurrent requests and honor cooldowns.
const cache = new Map<
  MarketSymbol,
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
  const entry = cache.get(symbol) ?? {};
  cache.set(symbol, entry);
  try {
    if (entry.blockedUntil && entry.blockedUntil > Date.now())
      throw new MarketError(
        entry.error?.message ?? "请稍后重试",
        entry.error?.status ?? 503,
        Math.ceil((entry.blockedUntil - Date.now()) / 1000),
      );
    let data = entry.data;
    if (!data || Date.now() - data.fetchedAt >= 10_000) {
      entry.pending ??= fetchBinanceMarket(symbol);
      try {
        data = await entry.pending;
        entry.data = data;
      } finally {
        entry.pending = undefined;
      }
    }
    const lastClosedAt =
      Date.parse(data.candles[data.candles.length - 1].datetime) + 60000;
    const ageMs =
      data.serverTime - lastClosedAt + Math.max(0, Date.now() - data.fetchedAt);
    if (ageMs > MAX_MARKET_AGE_MS)
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
