import type { Candle } from "./engine";
import {
  MarketError,
  aggregateCandles,
  validateMarketCandles,
  isMarketSymbol,
  intervalMs,
  type MarketSnapshot,
  type MarketSymbol,
  type CandleInterval,
} from "./market-types";
const bars: Record<Exclude<CandleInterval, "10m">, string> = {
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1H",
  "2h": "2H",
  "4h": "4H",
  "1d": "1Dutc",
};
export function decodeOkxCandles(
  raw: unknown,
  serverTime: number,
  interval: CandleInterval,
): Candle[] {
  if (!Array.isArray(raw)) throw new MarketError("OKX K 线格式无效");
  const rows: Candle[] = [];
  for (const r of raw) {
    if (!Array.isArray(r) || r.length < 9 || !["0", "1"].includes(String(r[8])))
      throw new MarketError("OKX K 线确认状态无效");
    const time = Number(r[0]);
    if (!Number.isSafeInteger(time) || time % intervalMs(interval) !== 0)
      throw new MarketError("OKX K 线时间无效");
    if (String(r[8]) !== "1" || time + intervalMs(interval) > serverTime)
      continue;
    const nums = r
      .slice(1, 6)
      .map((v) =>
        typeof v === "number" || (typeof v === "string" && v.trim() !== "")
          ? Number(v)
          : NaN,
      );
    rows.push({
      datetime: new Date(time).toISOString(),
      open: nums[0],
      high: nums[1],
      low: nums[2],
      close: nums[3],
      volume: nums[4],
    });
  }
  return rows.sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));
}
export async function fetchOkxMarket(
  symbol: MarketSymbol,
  fetcher: typeof fetch = fetch,
  interval: CandleInterval = "1m",
): Promise<Omit<MarketSnapshot, "ageMs">> {
  if (!isMarketSymbol(symbol))
    throw new MarketError("仅支持 BTCUSDT 和 ETHUSDT", 400);
  const requestedAt = Date.now(),
    base = interval === "10m" ? "5m" : interval;
  const deadline = AbortSignal.timeout(10000);
  async function get(path: string): Promise<unknown[]> {
    let response: Response;
    try {
      response = await fetcher("https://www.okx.com/api/v5/" + path, {
        cache: "no-store",
        redirect: "error",
        signal: deadline,
      });
    } catch {
      throw new MarketError("无法连接 OKX 公开行情；实时信号已暂停");
    }
    if (response.status === 429)
      throw new MarketError(
        "OKX 请求限流，请稍后重试",
        429,
        Math.max(
          15,
          Math.min(3600, Number(response.headers.get("Retry-After")) || 60),
        ),
      );
    if (response.status === 403 || response.status === 451)
      throw new MarketError("当前部署区域无法访问 OKX 公开行情", 503, 60);
    if (!response.ok) throw new MarketError("OKX 行情服务暂时不可用");
    let body: { code?: string; data?: unknown[] };
    try {
      body = await response.json();
    } catch {
      throw new MarketError("OKX 返回无效 JSON");
    }
    if (String(body.code) === "50011")
      throw new MarketError("OKX 请求限流，请稍后重试", 429, 60);
    if (String(body.code) !== "0" || !Array.isArray(body.data))
      throw new MarketError("OKX 行情响应无效");
    return body.data;
  }
  const clock = await get("public/time");
  const serverTime = Number((clock[0] as { ts?: string })?.ts);
  if (!Number.isSafeInteger(serverTime) || serverTime <= 0)
    throw new MarketError("OKX 服务器时间无效");
  const desired = interval === "1m" ? 1001 : interval === "10m" ? 404 : 202;
  let raw: unknown[] = [];
  let after: string | undefined;
  // API returns newest first; bounded pagination supplies 5m EMA100 warmup at 1m.
  for (let page = 0; page < 4 && raw.length < desired; page++) {
    const query = new URLSearchParams({
      instId: symbol === "BTCUSDT" ? "BTC-USDT" : "ETH-USDT",
      bar: bars[base],
      limit: String(Math.min(300, desired - raw.length)),
    });
    if (after) query.set("after", after);
    const batch = await get("market/history-candles?" + query);
    if (!batch.length) break;
    const times = batch.map((r) => (Array.isArray(r) ? Number(r[0]) : NaN));
    if (!times.every(Number.isSafeInteger))
      throw new MarketError("OKX 分页时间无效");
    const earliest = Math.min(...times);
    if (after && earliest >= Number(after))
      throw new MarketError("OKX 分页未前进");
    raw.push(...batch);
    after = String(earliest);
  }
  const decoded = validateMarketCandles(
    decodeOkxCandles(raw, serverTime, base),
    serverTime,
    base,
  );
  const candles =
    interval === "10m"
      ? validateMarketCandles(
          aggregateCandles(decoded, "10m", "5m"),
          serverTime,
          "10m",
        )
      : decoded;
  return {
    source: "okx",
    symbol,
    interval,
    candles,
    serverTime,
    fetchedAt: requestedAt,
  };
}
