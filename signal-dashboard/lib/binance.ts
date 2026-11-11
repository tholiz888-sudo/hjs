import type { Candle } from "./engine";

export * from "./market-types";
import {
  isMarketSymbol,
  intervalMs,
  validateMarketCandles,
  aggregateCandles,
  MarketError,
  type MarketSymbol,
  type MarketSnapshot,
  type CandleInterval,
} from "./market-types";
export function decodeBinanceKlines(
  value: unknown,
  serverTime: number,
  interval: CandleInterval = "1m",
): Candle[] {
  if (
    !Number.isSafeInteger(serverTime) ||
    serverTime <= 0 ||
    !Array.isArray(value)
  )
    throw new MarketError("币安行情响应格式无效");
  const candles: Candle[] = [];
  for (const raw of value) {
    if (!Array.isArray(raw) || raw.length < 7)
      throw new MarketError("币安 K 线格式无效");
    const [time, o, h, l, c, v, closeTime] = raw;
    if (
      !Number.isSafeInteger(time) ||
      time <= 0 ||
      time % intervalMs(interval) !== 0 ||
      closeTime !== time + intervalMs(interval) - 1
    )
      throw new MarketError("币安 K 线时间无效");
    if (closeTime >= serverTime) continue; // Never compute signals from an unfinished bar.
    const numbers = [o, h, l, c, v].map((n) =>
      typeof n === "number" || (typeof n === "string" && n.trim() !== "")
        ? Number(n)
        : NaN,
    );
    const [open, high, low, close, volume] = numbers;
    if (
      numbers.some((n) => !Number.isFinite(n)) ||
      Math.min(open, high, low, close) <= 0 ||
      volume < 0 ||
      high < Math.max(open, close) ||
      low > Math.min(open, close) ||
      low > high
    )
      throw new MarketError("币安 OHLCV 数值无效");
    candles.push({
      datetime: new Date(time).toISOString(),
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return validateMarketCandles(candles, serverTime, interval);
}

// Public market-data-only endpoint documented by Binance. No account or trading key.
// The hostname, interval and maximum count are fixed, and symbols are allowlisted.
export async function fetchBinanceMarket(
  symbol: MarketSymbol,
  fetcher: typeof fetch = fetch,
  interval: CandleInterval = "1m",
): Promise<Omit<MarketSnapshot, "ageMs">> {
  if (!isMarketSymbol(symbol))
    throw new MarketError("仅支持 BTCUSDT 和 ETHUSDT", 400);
  const get = async (path: string): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetcher(
        "https://data-api.binance.vision/api/v3/" + path,
        {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(8000),
        },
      );
    } catch {
      throw new MarketError("无法连接币安公开行情，请稍后重试；实时信号已暂停");
    }
    if (response.status === 429 || response.status === 418) {
      const retry = Number(response.headers.get("Retry-After"));
      throw new MarketError(
        "币安请求限流，等待后自动重试",
        429,
        Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) : 60,
      );
    }
    if (response.status === 451 || response.status === 403)
      throw new MarketError(
        "当前部署区域无法访问币安公开行情；实时信号已暂停",
        503,
        60,
      );
    if (!response.ok) throw new MarketError("币安行情服务暂时不可用", 502);
    try {
      return await response.json();
    } catch {
      throw new MarketError("币安行情返回了无效 JSON");
    }
  };
  const requestedAt = Date.now();
  const base = interval === "10m" ? "5m" : interval;
  const limit = interval === "1m" ? 1000 : interval === "10m" ? 404 : 202;
  const [clock, raw] = await Promise.all([
    get("time"),
    get(`klines?symbol=${symbol}&interval=${base}&limit=${limit}`),
  ]);
  const serverTime =
    typeof clock === "object" && clock !== null && "serverTime" in clock
      ? Number(clock.serverTime)
      : NaN;
  const decoded = decodeBinanceKlines(raw, serverTime, base);
  const candles =
    interval === "10m"
      ? validateMarketCandles(
          aggregateCandles(decoded, "10m", "5m"),
          serverTime,
          "10m",
        )
      : decoded;
  return {
    source: "binance",
    symbol,
    interval,
    candles,
    serverTime,
    fetchedAt: requestedAt,
  };
}
