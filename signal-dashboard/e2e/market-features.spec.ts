import { test, expect } from "@playwright/test";
import { analyze, simulate, defaults, type Candle } from "../lib/engine";
import {
  TIMEFRAMES,
  intervalMs,
  type CandleInterval,
  type Exchange,
  type MarketSnapshot,
} from "../lib/market-types";
const serverTime = Math.floor(Date.now() / 60000) * 60000 + 10000;
function fixture(exchange: Exchange, interval: CandleInterval): MarketSnapshot {
  const duration = intervalMs(interval),
    end = Math.floor(serverTime / duration) * duration,
    n = interval === "1m" ? 1000 : 200;
  return {
    source: exchange,
    symbol: "BTCUSDT",
    interval,
    serverTime,
    fetchedAt: Date.now(),
    ageMs: serverTime - end,
    candles: simulate(42, n).map((r, i) => ({
      ...r,
      datetime: new Date(end - (n - i) * duration).toISOString(),
    })),
  };
}

test("both exchanges support every chart interval without changing 1m strategy or sending history alerts", async ({
  page,
}) => {
  const requested: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/market?*", (route) => {
    const u = new URL(route.request().url());
    const exchange = u.searchParams.get("exchange") as Exchange;
    const interval = u.searchParams.get("interval") as CandleInterval;
    requested.push(`${exchange}:${interval}`);
    return route.fulfill({ json: fixture(exchange, interval) });
  });
  await page.goto("/");
  for (const exchange of ["binance", "okx"] as const) {
    await page.getByLabel("交易所", { exact: true }).selectOption(exchange);
    await expect(page.getByTestId("market-status")).toContainText(
      exchange === "okx" ? "OKX已连接" : "币安已连接",
    );
    for (const [interval, label] of TIMEFRAMES) {
      await page.getByLabel("K线周期", { exact: true }).selectOption(interval);
      await expect(
        page.getByRole("heading", { name: `${label} K 线`, exact: true }),
      ).toBeVisible();
      await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(60);
      await expect
        .poll(() => requested.includes(`${exchange}:${interval}`))
        .toBe(true);
      await expect(page.getByTestId("alert-count")).toContainText("0 条新信号");
    }
  }
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByLabel("K线周期", { exact: true })).toHaveValue("1d");
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);
    await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(60);
  }
  expect(errors).toEqual([]);
});

test("new closed-bar signal triggers one page/sound/system alert, never initial or repeated history", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const scope = window as unknown as {
      permissionRequests: number;
      systemNotices: string[];
    };
    scope.permissionRequests = 0;
    scope.systemNotices = [];
    class FakeNotification {
      static permission: NotificationPermission = "default";
      static async requestPermission() {
        scope.permissionRequests++;
        FakeNotification.permission = "granted";
        return "granted";
      }
      constructor(title: string) {
        scope.systemNotices.push(title);
      }
    }
    Object.defineProperty(window, "Notification", {
      value: FakeNotification,
      configurable: true,
    });
  });
  const raw = simulate(),
    signals = analyze(raw, defaults),
    index = signals.findIndex((s, i) => i > 200 && s.direction !== "neutral");
  const end = Math.floor(serverTime / 60000) * 60000;
  const rebased = raw.slice(0, index + 1).map((r, i) => ({
    ...r,
    datetime: new Date(end - (index + 1 - i) * 60000).toISOString(),
  }));
  function response(rows: Candle[]): MarketSnapshot {
    return {
      source: "binance",
      symbol: "BTCUSDT",
      interval: "1m",
      serverTime,
      fetchedAt: Date.now(),
      ageMs: serverTime - Date.parse(rows.at(-1)!.datetime) - 60000,
      candles: rows,
    };
  }
  let calls = 0;
  await page.route("**/api/market?*", (route) =>
    route.fulfill({
      json: response(++calls === 1 ? rebased.slice(0, -1) : rebased),
    }),
  );
  await page.goto("/");
  await expect(page.getByTestId("market-status")).toContainText("币安已连接");
  await expect(page.getByTestId("alert-count")).toContainText("0 条新信号");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { permissionRequests: number })
          .permissionRequests,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "开启系统通知", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "系统通知已开", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "开启声音", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "声音已开", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "刷新行情", exact: true }).click();
  await expect(page.getByTestId("signal-notice")).toContainText("研究信号");
  await expect(page.getByTestId("alert-count")).toContainText("1 条新信号");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { systemNotices: string[] }).systemNotices.length,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "刷新行情", exact: true }).click();
  await expect.poll(() => calls).toBe(3);
  await expect(page.getByTestId("alert-count")).toContainText("1 条新信号");
  await page.getByRole("button", { name: "测试提醒", exact: true }).click();
  await expect(page.getByTestId("signal-notice")).toContainText(
    "不代表产生了行情信号",
  );
  await expect(page.getByTestId("alert-count")).toContainText("1 条新信号");
});

test("OKX delay cannot replace a newer Binance selection and denied notification permission is nonblocking", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class Denied {
      static permission = "denied";
      static async requestPermission() {
        return "denied";
      }
    }
    Object.defineProperty(window, "Notification", {
      value: Denied,
      configurable: true,
    });
  });
  let started!: () => void, release!: () => void, finished!: () => void;
  const seen = new Promise<void>((r) => (started = r)),
    blocked = new Promise<void>((r) => (release = r)),
    done = new Promise<void>((r) => (finished = r));
  await page.route("**/api/market?*", async (route) => {
    const u = new URL(route.request().url()),
      exchange = u.searchParams.get("exchange") as Exchange,
      interval = u.searchParams.get("interval") as CandleInterval;
    if (exchange === "okx") {
      started();
      await blocked;
    }
    await route.fulfill({ json: fixture(exchange, interval) }).catch(() => {});
    if (exchange === "okx") finished();
  });
  await page.goto("/");
  await expect(page.getByTestId("market-status")).toContainText("币安已连接");
  await page.getByLabel("交易所", { exact: true }).selectOption("okx");
  await seen;
  await page.getByLabel("交易所", { exact: true }).selectOption("binance");
  await expect(page.getByTestId("market-status")).toContainText("币安已连接");
  release();
  await done;
  await expect(page.getByLabel("交易所", { exact: true })).toHaveValue(
    "binance",
  );
  await page.getByRole("button", { name: "开启系统通知", exact: true }).click();
  await expect(page.getByText(/系统通知未获许可/)).toBeVisible();
  await page.getByRole("button", { name: "测试提醒", exact: true }).click();
  await expect(page.getByTestId("signal-notice")).toContainText("测试提醒");
});
