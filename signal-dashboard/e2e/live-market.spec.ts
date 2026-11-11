import { test, expect } from "@playwright/test";
import { simulate } from "../lib/engine";
import type { MarketSnapshot, MarketSymbol } from "../lib/binance";

// Controlled Binance-shaped fixtures. These tests validate behavior, not Internet access.
function snapshot(symbol: MarketSymbol, ageMs = 10000): MarketSnapshot {
  const boundary = Math.floor(Date.now() / 60000) * 60000;
  const factor = symbol === "ETHUSDT" ? 0.05 : 1;
  return {
    source: "binance",
    symbol,
    interval: "1m",
    serverTime: boundary + 10000,
    fetchedAt: Date.now(),
    ageMs,
    candles: simulate(42, 1000).map((r, i) => ({
      ...r,
      datetime: new Date(boundary - (1000 - i) * 60000).toISOString(),
      open: r.open * factor,
      high: r.high * factor,
      low: r.low * factor,
      close: r.close * factor,
    })),
  };
}

test("mocked Binance BTC/ETH selection and automatic polling", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/market?*", (route) => {
    calls++;
    const symbol = new URL(route.request().url()).searchParams.get(
      "symbol",
    ) as MarketSymbol;
    return route.fulfill({ json: snapshot(symbol) });
  });
  await page.goto("/");
  await expect(page.getByTestId("market-status")).toContainText("币安已连接");
  await expect(page.getByText("币安最近收盘价", { exact: true })).toBeVisible();
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(60);
  const before = calls;
  await page.clock.fastForward(15100);
  await expect.poll(() => calls).toBeGreaterThan(before);
  await page.getByLabel("交易对", { exact: true }).selectOption("ETHUSDT");
  await expect(page.getByTestId("market-status")).toContainText("币安已连接");
  await expect(page.locator(".metric-value").first()).toHaveText(
    "$" +
      snapshot("ETHUSDT").candles.at(-1)!.close.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  );
  await expect(page.locator("main")).toContainText("ETH");
  await expect(
    page.getByRole("button", { name: "重新生成模拟行情" }),
  ).toHaveCount(0);
});

test("unavailable upstream shows no fabricated price and requires explicit demo selection", async ({
  page,
}) => {
  await page.route("**/api/market?*", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "当前部署区域无法访问币安公开行情" },
    }),
  );
  await page.goto("/");
  await expect(page.getByTestId("market-status")).toContainText(
    "实时信号已暂停",
  );
  await expect(page.getByText("实时信号暂停", { exact: true })).toBeVisible();
  await expect(page.locator(".metric-value")).toHaveCount(0);
  await expect(
    page.getByRole("alert").filter({ hasText: "不会自动改用模拟数据" }),
  ).toBeVisible();
  await page.getByLabel("数据源", { exact: true }).selectOption("simulated");
  await expect(page.getByTestId("market-status")).toContainText("模拟演示");
  await expect(page.getByText("最新模拟价格", { exact: true })).toBeVisible();
});

test("a previously successful stream pauses on failure and keeps only historical charts", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/market?*", (route) =>
    ++calls === 1
      ? route.fulfill({ json: snapshot("BTCUSDT") })
      : route.fulfill({
          status: 429,
          headers: { "Retry-After": "60" },
          json: { error: "币安请求限流" },
        }),
  );
  await page.goto("/");
  await expect(page.getByTestId("market-status")).toContainText("币安已连接");
  await page.clock.fastForward(15100);
  await expect(page.getByTestId("market-status")).toContainText(
    "实时信号已暂停",
  );
  await expect(page.getByText("暂停", { exact: true }).last()).toBeVisible();
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(60);
  await expect(page.getByRole("button", { name: /后重试/ })).toBeDisabled();
  const limitedCalls = calls;
  await page.clock.fastForward(30000);
  expect(calls).toBe(limitedCalls);
});

test("stale snapshots pause signals even before the next network request", async ({
  page,
}) => {
  await page.clock.install();
  await page.route("**/api/market?*", (route) =>
    route.fulfill({ json: snapshot("BTCUSDT", 119000) }),
  );
  await page.goto("/");
  await expect(page.getByTestId("market-status")).toContainText("币安已连接");
  await page.clock.fastForward(3000);
  await expect(page.getByTestId("market-status")).toContainText(
    "实时信号已暂停",
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "超过 2 分钟" }),
  ).toBeVisible();
});

test("late BTC responses cannot overwrite the selected ETH market", async ({
  page,
}) => {
  let seen!: () => void;
  const btcSeen = new Promise<void>((resolve) => {
    seen = resolve;
  });
  let release!: () => void;
  let returned!: () => void;
  const btcReturned = new Promise<void>((resolve) => {
    returned = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/market?*", async (route) => {
    const symbol = new URL(route.request().url()).searchParams.get(
      "symbol",
    ) as MarketSymbol;
    if (symbol === "BTCUSDT") {
      seen();
      await blocked;
    }
    await route.fulfill({ json: snapshot(symbol) }).catch(() => {});
    if (symbol === "BTCUSDT") returned();
  });
  await page.goto("/");
  await btcSeen;
  await page.getByLabel("交易对", { exact: true }).selectOption("ETHUSDT");
  await expect(page.getByTestId("market-status")).toContainText("币安已连接");
  release();
  await btcReturned;
  await expect(page.getByLabel("交易对", { exact: true })).toHaveValue(
    "ETHUSDT",
  );
  await expect(page.locator(".metric-value").first()).toHaveText(
    "$" +
      snapshot("ETHUSDT").candles.at(-1)!.close.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  );
});
