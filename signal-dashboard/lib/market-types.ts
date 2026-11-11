import type { Candle } from "./engine";
export const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
export type MarketSymbol = (typeof SYMBOLS)[number];
export const EXCHANGES = ["binance", "okx"] as const;
export type Exchange = (typeof EXCHANGES)[number];
export const exchangeNames: Record<Exchange, string> = {
  binance: "币安",
  okx: "OKX",
};
export const TIMEFRAMES = [
  ["1m", "1 分钟", 1],
  ["3m", "3 分钟", 3],
  ["5m", "5 分钟", 5],
  ["10m", "10 分钟", 10],
  ["15m", "15 分钟", 15],
  ["30m", "30 分钟", 30],
  ["1h", "1 小时", 60],
  ["2h", "2 小时", 120],
  ["4h", "4 小时", 240],
  ["1d", "1 天", 1440],
] as const;
export type CandleInterval = (typeof TIMEFRAMES)[number][0];
export const intervalMs = (interval: CandleInterval) =>
  TIMEFRAMES.find((row) => row[0] === interval)![2] * 60000;
export const intervalLabel = (interval: CandleInterval) =>
  TIMEFRAMES.find((row) => row[0] === interval)![1];
export const MAX_MARKET_AGE_MS = 120000;
export const MARKET_POLL_MS = 15000;
export const maxAgeForInterval = (interval: CandleInterval) =>
  interval === "1m"
    ? MAX_MARKET_AGE_MS
    : intervalMs(interval) + MAX_MARKET_AGE_MS;
export type MarketSnapshot = {
  source: Exchange;
  symbol: MarketSymbol;
  interval: CandleInterval;
  candles: Candle[];
  serverTime: number;
  fetchedAt: number;
  ageMs: number;
};
export const isMarketSymbol = (v: unknown): v is MarketSymbol =>
  typeof v === "string" && SYMBOLS.includes(v as MarketSymbol);
export const isExchange = (v: unknown): v is Exchange =>
  typeof v === "string" && EXCHANGES.includes(v as Exchange);
export const isCandleInterval = (v: unknown): v is CandleInterval =>
  typeof v === "string" && TIMEFRAMES.some((row) => row[0] === v);
export class MarketError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryAfter = 15,
  ) {
    super(message);
  }
}
export function validateMarketCandles(
  rows: Candle[],
  serverTime: number,
  interval: CandleInterval,
): Candle[] {
  if (
    !Number.isSafeInteger(serverTime) ||
    serverTime <= 0 ||
    !Array.isArray(rows)
  )
    throw new MarketError("行情响应格式无效");
  const duration = intervalMs(interval);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i],
      time = Date.parse(r.datetime);
    if (
      !Number.isSafeInteger(time) ||
      time % duration !== 0 ||
      time + duration > serverTime
    )
      throw new MarketError("已收盘 K 线时间无效");
    if (
      ![r.open, r.high, r.low, r.close, r.volume].every(Number.isFinite) ||
      Math.min(r.open, r.high, r.low, r.close) <= 0 ||
      r.volume < 0 ||
      r.high < Math.max(r.open, r.close) ||
      r.low > Math.min(r.open, r.close) ||
      r.low > r.high
    )
      throw new MarketError("OHLCV 数值无效");
    if (i && time - Date.parse(rows[i - 1].datetime) !== duration)
      throw new MarketError("K 线存在缺失或重复");
  }
  if (rows.length < (interval === "1m" ? 120 : 2))
    throw new MarketError("已收盘 K 线不足");
  const age = serverTime - Date.parse(rows.at(-1)!.datetime) - duration;
  if (age < 0 || age > maxAgeForInterval(interval))
    throw new MarketError("行情已过期，暂停研究信号");
  return rows;
}
// Both exchanges lack native 10m candles. Aggregate only complete UTC-aligned groups.
export function aggregateCandles(
  rows: Candle[],
  target: CandleInterval,
  base: CandleInterval,
): Candle[] {
  const duration = intervalMs(target),
    step = intervalMs(base),
    count = duration / step;
  if (!Number.isInteger(count) || count < 1)
    throw new MarketError("不支持此周期聚合");
  const groups = new Map<number, Candle[]>();
  for (const r of rows) {
    const key = Math.floor(Date.parse(r.datetime) / duration) * duration;
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .filter(
      ([key, group]) =>
        group.length === count &&
        group.every((r, i) => Date.parse(r.datetime) === key + i * step),
    )
    .map(([key, g]) => ({
      datetime: new Date(key).toISOString(),
      open: g[0].open,
      high: Math.max(...g.map((r) => r.high)),
      low: Math.min(...g.map((r) => r.low)),
      close: g.at(-1)!.close,
      volume: g.reduce((sum, r) => sum + r.volume, 0),
    }));
}
