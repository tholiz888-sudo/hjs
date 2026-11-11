import test from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  backtest,
  defaults,
  ema,
  parseCsv,
  parseCandleTime,
  rsi,
  simulate,
  validateParams,
} from "../lib/engine";
test("EMA and Wilder RSI handle trends and flat series", () => {
  assert.deepEqual(ema([10, 20, 30], 3), [10, 15, 22.5]);
  assert.equal(rsi(Array(20).fill(10), 7).at(-1), 50);
  assert.equal(
    rsi(
      Array.from({ length: 20 }, (_, i) => i),
      7,
    ).at(-1),
    100,
  );
});
test("simulation is repeatable and signals do not look ahead", () => {
  const rows = simulate();
  assert.deepEqual(rows, simulate());
  const all = analyze(rows);
  assert.deepEqual(analyze(rows.slice(0, 287)), all.slice(0, 287));
  assert.ok(all.slice(0, 99).every((s) => s.direction === "neutral"));
  for (const s of all.filter((s) => s.direction !== "neutral"))
    assert.ok(s.ready && s.filters.every((f) => f.pass));
});
test("backtest uses next open, ten bars, non-overlapping entries and correct equity", () => {
  const rows = simulate(),
    result = backtest(rows);
  assert.ok(result.total > 0);
  let equity = 10000;
  for (let i = 0; i < result.trades.length; i++) {
    const t = result.trades[i];
    const idx = rows.findIndex((r) => r.datetime === t.time);
    assert.equal(t.entry, rows[idx].open);
    assert.equal(t.exit, rows[idx + 9].close);
    assert.equal(Date.parse(t.exitTime) - Date.parse(t.time), 600000);
    const ret = (t.exit / t.entry - 1) * (t.direction === "bullish" ? 1 : -1);
    equity *= 1 + ret;
    assert.equal(t.equity, equity);
    if (i)
      assert.ok(
        Date.parse(t.time) >= Date.parse(result.trades[i - 1].exitTime),
      );
  }
  assert.equal(result.returnPct, (equity / 10000 - 1) * 100);
});
function csv() {
  return (
    "datetime,open,high,low,close,volume\n" +
    simulate(42, 120)
      .map((r) =>
        [r.datetime, r.open, r.high, r.low, r.close, r.volume].join(","),
      )
      .join("\n")
  );
}
test("CSV accepts valid data and rejects missing, duplicated and invalid candles", () => {
  assert.equal(parseCsv(csv()).length, 120);
  assert.throws(() => parseCsv("time,price\n1,2"), /缺少/);
  const lines = csv().split("\n");
  lines[2] = lines[1];
  assert.throws(() => parseCsv(lines.join("\n")), /连续/);
  assert.throws(() => parseCsv(csv().replace("Z,", ",")), /时区/);
  assert.throws(
    () =>
      parseCsv(
        "datetime,open,high,low,close,volume\n2026-11-10T00:00:00Z,10,2,1,9,5",
      ),
    /无效/,
  );
});
test("invalid parameter relationships are rejected", () => {
  assert.ok(validateParams({ ...defaults, fast: 20 }));
  assert.ok(validateParams({ ...defaults, rsiMin: 80 }));
  assert.ok(validateParams({ ...defaults, trend: NaN }));
  assert.equal(validateParams(defaults), null);
});

test("disabled trend filtering allows valid early signals without 5m EMA warmup", () => {
  const rows = simulate();
  const relaxed = {
    ...defaults,
    rsiMin: 0,
    rsiMax: 100,
    volumeMultiplier: 0.5,
  };
  const enabled = analyze(rows, relaxed);
  const disabled = analyze(rows, { ...relaxed, trendEnabled: false });
  assert.ok(enabled.slice(0, 99).every((s) => s.direction === "neutral"));
  assert.ok(disabled.slice(20, 99).some((s) => s.direction !== "neutral"));
  assert.deepEqual(
    analyze(rows.slice(0, 287), { ...relaxed, trendEnabled: false }),
    disabled.slice(0, 287),
  );
  assert.ok(disabled.every((s) => s.filters[0].enabled === false));
});

test("maximum consecutive losses matches the completed trade sequence", () => {
  const result = backtest(simulate(), { ...defaults, trendEnabled: false });
  let streak = 0,
    maximum = 0;
  for (const t of result.trades) {
    streak = t.returnPct < 0 ? streak + 1 : 0;
    maximum = Math.max(maximum, streak);
  }
  assert.ok(maximum > 0);
  assert.equal(result.maxConsecutiveLosses, maximum);
  assert.equal(backtest([], defaults).maxConsecutiveLosses, 0);
});

test("opposing trend and momentum never report all filters satisfied", () => {
  const signals = analyze(simulate());
  const conflict = signals[223];
  assert.equal(conflict.direction, "neutral");
  assert.equal(conflict.filters[0].pass, true);
  assert.equal(conflict.filters[1].pass, false);
  assert.match(conflict.filters[1].detail, /不一致/);
  for (const s of signals)
    if (s.direction === "neutral") assert.ok(s.filters.some((f) => !f.pass));
  const warmup = analyze(simulate(), {
    ...defaults,
    trendEnabled: false,
    slow: 100,
  });
  for (const s of warmup.slice(0, 100)) assert.equal(s.filters[1].pass, false);
});

test("calendar validation rejects normalized dates, invalid times and nonzero fractional seconds", () => {
  for (const raw of [
    "2026-02-30T00:00:00Z",
    "2026-02-29T00:00:00Z",
    "2024-04-31T00:00:00Z",
    "2026-11-10T24:00:00Z",
    "2026-11-10T00:00:00.0001Z",
    "2026-11-10T00:00:01Z",
    "2026-11-10T00:00:00+14:01",
  ])
    assert.throws(() => parseCandleTime(raw), /无效|分钟/);
  assert.equal(
    parseCandleTime("2024-02-29T08:00:00+08:00"),
    Date.UTC(2024, 1, 29),
  );
  assert.equal(
    parseCandleTime("2026-11-10T00:00:00.000Z"),
    Date.UTC(2026, 10, 10),
  );
  const text =
    "datetime,open,high,low,close,volume\n" +
    Array.from(
      { length: 120 },
      (_, i) =>
        `2026-02-30T${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z,100,101,99,100,10`,
    ).join("\n");
  assert.throws(() => parseCsv(text), /第 2 行.*日期无效/);
});

test("capital exhaustion caps the loss, records the raw move and stops further trades", () => {
  const rows = simulate();
  const params = {
    ...defaults,
    trendEnabled: false,
    rsiMin: 0,
    rsiMax: 100,
    volumeMultiplier: 0.5,
  };
  const baseline = backtest(rows, params);
  assert.equal(baseline.trades[0].direction, "bearish");
  const entry = rows.findIndex((r) => r.datetime === baseline.trades[0].time);
  const stressed = rows.map((r, i) =>
    i > entry
      ? {
          ...r,
          open: r.open * 3,
          high: r.high * 3,
          low: r.low * 3,
          close: r.close * 3,
        }
      : r,
  );
  const result = backtest(stressed, params);
  assert.equal(result.capitalDepleted, true);
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].equity, 0);
  assert.equal(result.trades[0].returnPct, -100);
  assert.ok(result.trades[0].rawReturnPct < -100);
  assert.equal(result.returnPct, -100);
  assert.equal(result.maxDrawdown, 100);
  assert.ok(result.curve.every((p) => p.equity >= 0));
  assert.equal(backtest([], defaults).capitalDepleted, false);
});
