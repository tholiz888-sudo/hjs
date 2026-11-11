import test from "node:test";
import assert from "node:assert/strict";
import { simulate, analyze } from "../lib/engine";
import { decodeOkxCandles, fetchOkxMarket } from "../lib/okx";
import { fetchBinanceMarket } from "../lib/binance";
import {
  TIMEFRAMES,
  aggregateCandles,
  intervalMs,
  validateMarketCandles,
} from "../lib/market-types";
import { advanceSignalAlert } from "../lib/alerts";
const boundary = Math.floor(Date.now() / 86400000) * 86400000;
function candles(interval: (typeof TIMEFRAMES)[number][0], n = 1001) {
  const step = intervalMs(interval);
  return simulate(42, n).map((r, i) => ({
    ...r,
    datetime: new Date(boundary - (n - i) * step).toISOString(),
  }));
}
const okxWire = (rows: ReturnType<typeof candles>) =>
  rows
    .map((r) => [
      String(Date.parse(r.datetime)),
      String(r.open),
      String(r.high),
      String(r.low),
      String(r.close),
      String(r.volume),
      "0",
      "0",
      "1",
    ])
    .reverse();

test("OKX pagination supplies contiguous 1m history and spot instrument IDs", async () => {
  const rows = candles("1m"),
    wire = okxWire(rows),
    requests: string[] = [];
  const fake: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url.toString());
    if (url.pathname.endsWith("/time"))
      return Response.json({
        code: "0",
        data: [{ ts: String(boundary + 10000) }],
      });
    assert.equal(url.searchParams.get("instId"), "ETH-USDT");
    assert.equal(url.searchParams.get("bar"), "1m");
    const after = Number(url.searchParams.get("after") || Infinity),
      limit = Number(url.searchParams.get("limit"));
    return Response.json({
      code: "0",
      data: wire.filter((r) => Number(r[0]) < after).slice(0, limit),
    });
  };
  const result = await fetchOkxMarket("ETHUSDT", fake);
  assert.equal(result.source, "okx");
  assert.deepEqual(result.candles, rows);
  assert.equal(requests.length, 5);
  assert.ok(requests.every((u) => u.startsWith("https://www.okx.com/")));
});

test("all requested intervals work with Binance and OKX, including complete synthetic 10m", async () => {
  for (const [interval] of TIMEFRAMES) {
    const base = interval === "10m" ? "5m" : interval,
      rows = candles(base),
      wire = okxWire(rows);
    const fakeOkx: typeof fetch = async (input) => {
      const u = new URL(String(input));
      if (u.pathname.endsWith("/time"))
        return Response.json({
          code: "0",
          data: [{ ts: String(boundary + 10000) }],
        });
      if (interval === "1d") assert.equal(u.searchParams.get("bar"), "1Dutc");
      const after = Number(u.searchParams.get("after") || Infinity),
        limit = Number(u.searchParams.get("limit"));
      return Response.json({
        code: "0",
        data: wire.filter((r) => Number(r[0]) < after).slice(0, limit),
      });
    };
    const fakeBinance: typeof fetch = async (input) => {
      const u = new URL(String(input));
      if (u.pathname.endsWith("/time"))
        return Response.json({ serverTime: boundary + 10000 });
      assert.equal(u.searchParams.get("interval"), base);
      return Response.json(
        rows
          .slice(-Number(u.searchParams.get("limit")))
          .map((r) => [
            Date.parse(r.datetime),
            r.open,
            r.high,
            r.low,
            r.close,
            r.volume,
            Date.parse(r.datetime) + intervalMs(base) - 1,
          ]),
      );
    };
    for (const result of [
      await fetchOkxMarket("BTCUSDT", fakeOkx, interval),
      await fetchBinanceMarket("BTCUSDT", fakeBinance, interval),
    ]) {
      assert.equal(result.interval, interval);
      assert.ok(result.candles.length >= 2);
      assert.doesNotThrow(() =>
        validateMarketCandles(result.candles, result.serverTime, interval),
      );
      assert.equal(
        Date.parse(result.candles.at(-1)!.datetime) + intervalMs(interval),
        boundary,
      );
    }
  }
});

test("10m aggregation preserves OHLCV and excludes partial edge groups", () => {
  const rows = candles("5m", 6);
  const aggregate = aggregateCandles(rows, "10m", "5m");
  assert.equal(aggregate.length, 3);
  assert.equal(aggregate[0].open, rows[0].open);
  assert.equal(aggregate[0].close, rows[1].close);
  assert.equal(aggregate[0].volume, rows[0].volume + rows[1].volume);
  assert.equal(aggregate[0].high, Math.max(rows[0].high, rows[1].high));
  assert.equal(aggregate[0].low, Math.min(rows[0].low, rows[1].low));
  assert.equal(aggregateCandles(rows.slice(1, -1), "10m", "5m").length, 1);
});

test("OKX ignores unconfirmed bars and rejects rate limits, malformed and missing history", async () => {
  const rows = candles("1m", 150),
    wire = okxWire(rows);
  const pending = [String(boundary), "10", "11", "9", "10", "5", "0", "0", "0"];
  assert.deepEqual(
    decodeOkxCandles([pending, ...wire], boundary + 10000, "1m"),
    rows,
  );
  assert.throws(
    () =>
      validateMarketCandles(
        decodeOkxCandles(
          wire.slice(0, 5).concat(wire.slice(6)),
          boundary + 10000,
          "1m",
        ),
        boundary + 10000,
        "1m",
      ),
    /缺失/,
  );
  await assert.rejects(
    fetchOkxMarket("BTCUSDT", async () =>
      Response.json({ code: "50011", data: [] }),
    ),
    /限流/,
  );
  await assert.rejects(
    fetchOkxMarket("BTCUSDT", async () => new Response("{}", { status: 451 })),
    /区域/,
  );
  await assert.rejects(
    fetchOkxMarket("BTCUSDT", async () =>
      Response.json({ code: "0", data: [{ ts: "invalid" }] }),
    ),
    /时间无效/,
  );
});

test("alerts ignore initial history, deduplicate closed bars and reset on source or parameters", () => {
  const signals = analyze(simulate());
  const index = signals.findIndex(
    (s, i) => i > 120 && s.direction !== "neutral",
  );
  const signal = signals[index];
  let result = advanceSignalAlert(null, "binance:BTC:v1", signals[index - 1]);
  assert.equal(result.notify, false);
  result = advanceSignalAlert(result.cursor, "binance:BTC:v1", signal);
  assert.equal(result.notify, true);
  assert.equal(
    advanceSignalAlert(result.cursor, "binance:BTC:v1", signal).notify,
    false,
  );
  assert.equal(
    advanceSignalAlert(result.cursor, "okx:BTC:v1", signal).notify,
    false,
  );
  assert.equal(
    advanceSignalAlert(result.cursor, "binance:BTC:v2", signal).notify,
    false,
  );
  assert.equal(
    advanceSignalAlert(result.cursor, "binance:BTC:v1", signals[index - 1])
      .notify,
    false,
  );
});
