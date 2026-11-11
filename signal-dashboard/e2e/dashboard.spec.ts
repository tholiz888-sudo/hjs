import { test, expect } from "@playwright/test";
import { backtest, defaults, simulate, type Candle } from "../lib/engine";

const disclaimer =
  "仅供研究学习，不构成任何投资建议。历史表现不代表未来结果，交易有风险，请谨慎决策。";
const toCsv = (rows: Candle[]) =>
  "datetime,open,high,low,close,volume\n" +
  rows
    .map((r) =>
      [r.datetime, r.open, r.high, r.low, r.close, r.volume].join(","),
    )
    .join("\n");

test.beforeEach(async ({ page }) => {
  await page.route("**/api/market?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "测试环境未连接外部行情" }),
    }),
  );
});

test("dashboard draws candles and supports chart controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("数据源", { exact: true }).selectOption("simulated");
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(60);
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await page.getByRole("button", { name: "30 根", exact: true }).click();
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(30);
  await page.getByLabel("显示均线").uncheck();
  await expect(page.locator(".recharts-line")).toHaveCount(0);
  await page.getByRole("button", { name: "重新生成模拟行情" }).click();
  await expect(page.getByRole("status")).toContainText("已重新生成");
  expect(errors).toEqual([]);
});

test("uploaded CSV survives navigation to change strategy parameters", async ({
  page,
}) => {
  await page.goto("/backtest");
  await page.getByLabel("上传 OHLCV CSV 文件").setInputFiles({
    name: "study.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(toCsv(simulate(42, 720))),
  });
  await expect(page.locator("main [role=status]")).toContainText("study.csv");
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "规则与参数" })
    .click();
  await page.locator("#fast").fill("4");
  await page.getByRole("switch").uncheck();
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "策略回测" })
    .click();
  await expect(page.locator("main [role=status]")).toContainText("study.csv");
  await expect(page.locator("main [role=status]")).toContainText("720 根");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("signal-params-v1")!).fast,
    ),
  ).toBe(4);
  const expected = backtest(simulate(42, 720), {
    ...defaults,
    fast: 4,
    trendEnabled: false,
  });
  await expect(
    page.getByText(`共 ${expected.total} 笔 · 第 1 /`, { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "使用模拟数据" }).click();
  await expect(page.locator("main [role=status]")).toContainText(
    "内置模拟数据",
  );
  await expect(page.locator("main [role=status]")).toContainText("1,440 根");
});

test("invalid calendar date rejects the file and keeps the last valid upload", async ({
  page,
}) => {
  await page.goto("/backtest");
  const upload = page.getByLabel("上传 OHLCV CSV 文件");
  await upload.setInputFiles({
    name: "valid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(toCsv(simulate(42, 120))),
  });
  await expect(page.locator("main [role=status]")).toContainText("valid.csv");
  await upload.setInputFiles({
    name: "bad-date.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "datetime,open,high,low,close,volume\n2026-02-30T00:00:00Z,100,101,99,100,10",
    ),
  });
  await expect(page.locator("p[role=alert]")).toContainText("日历日期无效");
  await expect(page.locator("main [role=status]")).toContainText("valid.csv");
});

test("capital exhaustion is displayed and no further trades are simulated", async ({
  page,
}) => {
  const params = {
    ...defaults,
    trendEnabled: false,
    rsiMin: 0,
    rsiMax: 100,
    volumeMultiplier: 0.5,
  };
  await page.addInitScript(
    (p) => localStorage.setItem("signal-params-v1", JSON.stringify(p)),
    params,
  );
  const rows = simulate();
  const first = backtest(rows, params).trades[0];
  const index = rows.findIndex((r) => r.datetime === first.time);
  const stressed = rows.map((r, i) =>
    i > index
      ? {
          ...r,
          open: r.open * 3,
          high: r.high * 3,
          low: r.low * 3,
          close: r.close * 3,
        }
      : r,
  );
  await page.goto("/backtest");
  await page.getByLabel("上传 OHLCV CSV 文件").setInputFiles({
    name: "stress.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(toCsv(stressed)),
  });
  await expect(page.locator("p[role=alert]")).toContainText(
    "模拟本金已耗尽，回测已停止",
  );
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("-100.000%");
  await expect(page.locator("tbody")).toContainText("本金耗尽");
});

test("risk notices and layout remain usable on narrow screens", async ({
  page,
}) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ["/", "/rules", "/backtest"]) {
      await page.goto(route);
      await expect(page.getByText(disclaimer, { exact: true })).toHaveCount(2);
      const layout = await page.evaluate(() => {
        const banner = document
          .querySelector(".risk-banner")!
          .getBoundingClientRect();
        const text = document
          .querySelector(".risk-banner span")!
          .getBoundingClientRect();
        return {
          overflow:
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
          clipped: text.bottom > banner.bottom || text.top < banner.top,
        };
      });
      expect(layout).toEqual({ overflow: false, clipped: false });
    }
  }
});
