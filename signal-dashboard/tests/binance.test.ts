import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../app/api/market/route";
import {
  decodeBinanceKlines,
  fetchBinanceMarket,
  MAX_MARKET_AGE_MS,
  MarketError,
} from "../lib/binance";
import { readMarketSnapshot } from "../lib/use-market";
import { simulate } from "../lib/engine";

const boundary = Math.floor(Date.now() / 60000) * 60000;
const serverTime = boundary + 10000;
const rows = simulate(42, 150).map((r, i) => ({
  ...r,
  datetime: new Date(boundary - (150 - i) * 60000).toISOString(),
}));
const wire = rows.map((r) => [
  Date.parse(r.datetime),
  String(r.open),
  String(r.high),
  String(r.low),
  String(r.close),
  String(r.volume),
  Date.parse(r.datetime) + 59999,
]);
const fetchFixture =
  (status = 200): typeof fetch =>
  async (input) =>
    String(input).endsWith("/time")
      ? Response.json({ serverTime })
      : Response.json(wire, { status });

test("Binance adapter uses fixed public endpoints and parses closed BTC/ETH bars", async () => {
  const requests: string[] = [];
  const fake: typeof fetch = async (input, init) => {
    requests.push(String(input));
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    return fetchFixture()(input, init);
  };
  const result = await fetchBinanceMarket("BTCUSDT", fake);
  assert.deepEqual(result.candles, rows);
  assert.equal(result.symbol, "BTCUSDT");
  assert.ok(
    requests.every((url) =>
      url.startsWith("https://data-api.binance.vision/api/v3/"),
    ),
  );
  assert.ok(
    requests.some((url) =>
      url.includes("symbol=BTCUSDT&interval=1m&limit=1000"),
    ),
  );
  assert.equal((await fetchBinanceMarket("ETHUSDT", fake)).symbol, "ETHUSDT");
});

test("unfinished bars are excluded, missing/duplicate/invalid/stale bars fail closed", () => {
  const unfinished = [
    boundary,
    "100",
    "101",
    "99",
    "100",
    "20",
    boundary + 59999,
  ];
  assert.equal(
    decodeBinanceKlines([...wire, unfinished], serverTime).length,
    rows.length,
  );
  assert.throws(
    () =>
      decodeBinanceKlines([...wire.slice(0, 5), ...wire.slice(6)], serverTime),
    /缺失/,
  );
  assert.throws(
    () =>
      decodeBinanceKlines(
        [...wire.slice(0, 5), wire[4], ...wire.slice(5)],
        serverTime,
      ),
    /重复/,
  );
  const invalid = wire.map((row) => [...row]);
  invalid[10][2] = "0";
  assert.throws(() => decodeBinanceKlines(invalid, serverTime), /数值无效/);
  assert.throws(
    () => decodeBinanceKlines(wire, boundary + MAX_MARKET_AGE_MS + 1),
    /过期/,
  );
  assert.throws(
    () => decodeBinanceKlines(wire.slice(0, 20), serverTime),
    /不足/,
  );
});

test("upstream rate limits, region denials, malformed data and network errors are explicit", async () => {
  for (const status of [429, 418, 451, 403, 500]) {
    const fake: typeof fetch = async () =>
      new Response("{}", { status, headers: { "Retry-After": "45" } });
    await assert.rejects(
      fetchBinanceMarket("BTCUSDT", fake),
      (error: unknown) =>
        error instanceof MarketError &&
        (status === 429 || status === 418
          ? error.status === 429 && error.retryAfter === 45
          : status === 451 || status === 403
            ? error.status === 503
            : error.status === 502),
    );
  }
  await assert.rejects(
    fetchBinanceMarket("BTCUSDT", async () => {
      throw new Error("offline");
    }),
    /无法连接/,
  );
  await assert.rejects(
    fetchBinanceMarket("BTCUSDT", async () => new Response("not-json")),
    /无效 JSON/,
  );
});

test("browser snapshot validation rejects wrong symbols and old responses", async () => {
  const body = {
    ...(await fetchBinanceMarket("BTCUSDT", fetchFixture())),
    ageMs: 10000,
  };
  assert.equal(readMarketSnapshot(body, "BTCUSDT").candles.length, 150);
  assert.throws(() => readMarketSnapshot(body, "ETHUSDT"), /无效/);
  assert.throws(
    () =>
      readMarketSnapshot({ ...body, ageMs: MAX_MARKET_AGE_MS + 1 }, "BTCUSDT"),
    /无效/,
  );
});

test("API rejects arbitrary symbols, coalesces BTC requests and observes ETH cooldown", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return fetchFixture()(input, init);
  };
  const invalid = await GET(
    new NextRequest("http://localhost/api/market?symbol=SOLUSDT"),
  );
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);
  for (const query of ["exchange=unknown", "interval=7m"]) {
    const response = await GET(
      new NextRequest("http://localhost/api/market?" + query),
    );
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  }
  const result = await Promise.all([
    GET(new NextRequest("http://localhost/api/market?symbol=BTCUSDT")),
    GET(new NextRequest("http://localhost/api/market?symbol=BTCUSDT")),
  ]);
  assert.ok(result.every((r) => r.status === 200));
  assert.equal(calls, 2);
  await GET(new NextRequest("http://localhost/api/market?symbol=BTCUSDT"));
  assert.equal(calls, 2);
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  };
  const limited = await GET(
    new NextRequest("http://localhost/api/market?symbol=ETHUSDT"),
  );
  assert.equal(limited.status, 429);
  const before = calls;
  const cooldown = await GET(
    new NextRequest("http://localhost/api/market?symbol=ETHUSDT"),
  );
  assert.equal(cooldown.status, 429);
  assert.equal(calls, before);
});
