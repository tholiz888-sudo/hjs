export type Candle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type Params = {
  trend: number;
  trendEnabled: boolean;
  fast: number;
  slow: number;
  rsi: number;
  rsiMin: number;
  rsiMax: number;
  volumePeriod: number;
  volumeMultiplier: number;
};
export const defaults: Params = {
  trend: 20,
  trendEnabled: true,
  fast: 3,
  slow: 8,
  rsi: 7,
  rsiMin: 30,
  rsiMax: 70,
  volumePeriod: 20,
  volumeMultiplier: 1.1,
};
export type Direction = "bullish" | "bearish" | "neutral";
export const labels: Record<Direction, string> = {
  bullish: "看涨",
  bearish: "看跌",
  neutral: "观望",
};
export type Filter = {
  name: string;
  detail: string;
  pass: boolean;
  enabled?: boolean;
};
export type Signal = {
  direction: Direction;
  filters: Filter[];
  rsi: number;
  volumeRatio: number;
  fast: number;
  slow: number;
  trend: number;
  time: string;
  ready: boolean;
};
export function validateParams(p: Params): string | null {
  if (typeof p.trendEnabled !== "boolean") return "趋势过滤开关必须为布尔值";
  const periods = [p.trend, p.fast, p.slow, p.rsi, p.volumePeriod];
  if (periods.some((n) => !Number.isInteger(n) || n < 2 || n > 100))
    return "指标周期必须为 2–100 的整数";
  if (p.fast >= p.slow) return "快速 EMA 周期必须小于慢速 EMA 周期";
  if (
    ![p.rsiMin, p.rsiMax, p.volumeMultiplier].every(Number.isFinite) ||
    p.rsiMin < 0 ||
    p.rsiMax > 100 ||
    p.rsiMin >= p.rsiMax
  )
    return "RSI 下限必须小于上限，且在 0–100 内";
  if (p.volumeMultiplier < 0.5 || p.volumeMultiplier > 5)
    return "成交量倍数须在 0.5–5 之间";
  return null;
}
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  return values.reduce<number[]>((a, v, i) => {
    a.push(i ? v * k + a[i - 1] * (1 - k) : v);
    return a;
  }, []);
}
export function rsi(values: number[], period: number): number[] {
  const result = new Array(values.length).fill(50);
  let gain = 0,
    loss = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (i <= period) {
      gain += Math.max(d, 0) / period;
      loss += Math.max(-d, 0) / period;
    } else {
      gain = (gain * (period - 1) + Math.max(d, 0)) / period;
      loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    }
    if (i >= period)
      result[i] =
        loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
  }
  return result;
}
export function simulate(seed = 42, count = 1440): Candle[] {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  let last = 67420;
  const start = Date.UTC(2026, 10, 10, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const open = last;
    const move = (random() - 0.5) * 94 + Math.sin(i / 23) * 9;
    const close = open + move;
    last = close;
    return {
      datetime: new Date(start + i * 60000).toISOString(),
      open,
      close,
      high: Math.max(open, close) + random() * 36,
      low: Math.min(open, close) - random() * 36,
      volume: 110 + random() * 190 + (Math.abs(move) > 35 ? 110 : 0),
    };
  });
}
// Only completed 5-minute bars are visible to a 1-minute decision.
export function analyze(rows: Candle[], p: Params = defaults): Signal[] {
  const error = validateParams(p);
  if (error) throw new Error(error);
  const closes = rows.map((r) => r.close),
    fast = ema(closes, p.fast),
    slow = ema(closes, p.slow),
    rs = rsi(closes, p.rsi);
  const groups = new Map<
    number,
    { last: number; count: number; end: number }
  >();
  rows.forEach((r, i) => {
    const key = Math.floor(Date.parse(r.datetime) / 300000);
    const g = groups.get(key);
    groups.set(key, { last: r.close, count: (g?.count ?? 0) + 1, end: i });
  });
  const completed = [...groups.entries()]
    .filter(
      ([key, g]) =>
        g.count === 5 &&
        Date.parse(rows[g.end].datetime) === key * 300000 + 240000,
    )
    .map(([, g]) => g);
  const trends = ema(
    completed.map((g) => g.last),
    p.trend,
  );
  let cursor = -1;
  return rows.map((row, i) => {
    while (cursor + 1 < completed.length && completed[cursor + 1].end <= i)
      cursor++;
    const t = cursor >= 0 ? trends[cursor] : 0;
    const up = cursor >= p.trend - 1 && row.close > t,
      down = cursor >= p.trend - 1 && row.close < t;
    const crossUp = i > 0 && fast[i] > slow[i] && fast[i - 1] <= slow[i - 1],
      crossDown = i > 0 && fast[i] < slow[i] && fast[i - 1] >= slow[i - 1];
    const avg =
      i >= p.volumePeriod
        ? rows.slice(i - p.volumePeriod, i).reduce((s, r) => s + r.volume, 0) /
          p.volumePeriod
        : 0;
    const ratio = avg ? row.volume / avg : 0,
      okRsi = rs[i] >= p.rsiMin && rs[i] <= p.rsiMax,
      okVol = ratio > p.volumeMultiplier;
    const ready =
      (!p.trendEnabled || cursor >= p.trend - 1) &&
      i >= Math.max(p.slow, p.rsi, p.volumePeriod);
    const direction: Direction =
      ready && (!p.trendEnabled || up) && crossUp && okRsi && okVol
        ? "bullish"
        : ready && (!p.trendEnabled || down) && crossDown && okRsi && okVol
          ? "bearish"
          : "neutral";
    return {
      direction,
      ready,
      rsi: rs[i],
      volumeRatio: ratio,
      fast: fast[i],
      slow: slow[i],
      trend: t,
      time: new Date(Date.parse(row.datetime) + 60000).toISOString(),
      filters: [
        {
          name: `5 分钟 EMA${p.trend} 趋势`,
          enabled: p.trendEnabled,
          detail: !p.trendEnabled
            ? "已关闭，不限制涨跌方向"
            : up
              ? "价格高于已收盘 5 分钟 EMA，只允许看涨"
              : down
                ? "价格低于已收盘 5 分钟 EMA，只允许看跌"
                : "趋势未形成或预热不足",
          pass: !p.trendEnabled || up || down,
        },
        {
          name: `1 分钟 EMA${p.fast} / EMA${p.slow}`,
          detail: crossUp
            ? "本根收盘发生上穿"
            : crossDown
              ? "本根收盘发生下穿"
              : "本根收盘未发生交叉",
          pass: crossUp || crossDown,
        },
        {
          name: `RSI(${p.rsi}) 区间过滤`,
          detail: `${rs[i].toFixed(1)} · 有效区间 ${p.rsiMin}–${p.rsiMax}`,
          pass: okRsi,
        },
        {
          name: "成交量确认",
          detail: `前 ${p.volumePeriod} 根均量的 ${ratio.toFixed(2)}× / 阈值 ${p.volumeMultiplier}×`,
          pass: okVol,
        },
      ],
    };
  });
}
export type Trade = {
  time: string;
  exitTime: string;
  direction: Direction;
  entry: number;
  exit: number;
  returnPct: number;
  equity: number;
};
export function backtest(rows: Candle[], p: Params = defaults) {
  const signals = analyze(rows, p);
  const trades: Trade[] = [];
  let equity = 10000,
    peak = equity,
    maxDrawdown = 0,
    lossStreak = 0,
    maxConsecutiveLosses = 0;
  const curve = [{ time: rows[0]?.datetime ?? "", equity, returnPct: 0 }];
  // Decision at closed candle i, entry at next open, exit after ten 1-minute bars. No overlapping trades.
  for (let i = 0; i + 10 < rows.length; i++) {
    const s = signals[i];
    if (s.direction === "neutral") continue;
    const entry = rows[i + 1].open,
      exit = rows[i + 10].close;
    const ret = (exit / entry - 1) * (s.direction === "bullish" ? 1 : -1);
    lossStreak = ret < 0 ? lossStreak + 1 : 0;
    maxConsecutiveLosses = Math.max(maxConsecutiveLosses, lossStreak);
    equity *= 1 + ret;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
    trades.push({
      time: rows[i + 1].datetime,
      exitTime: new Date(
        Date.parse(rows[i + 10].datetime) + 60000,
      ).toISOString(),
      direction: s.direction,
      entry,
      exit,
      returnPct: ret * 100,
      equity,
    });
    curve.push({
      time: new Date(Date.parse(rows[i + 10].datetime) + 60000).toISOString(),
      equity,
      returnPct: (equity / 10000 - 1) * 100,
    });
    i += 9;
  }
  return {
    trades,
    curve,
    total: trades.length,
    winRate: trades.length
      ? (trades.filter((t) => t.returnPct > 0).length / trades.length) * 100
      : 0,
    average: trades.length
      ? trades.reduce((s, t) => s + t.returnPct, 0) / trades.length
      : 0,
    maxDrawdown,
    maxConsecutiveLosses,
    returnPct: (equity / 10000 - 1) * 100,
  };
}
export function parseCsv(text: string): Candle[] {
  const lines = text
    .trim()
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV 至少需要表头和一行数据");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const fields = ["datetime", "open", "high", "low", "close", "volume"];
  if (fields.some((f) => !headers.includes(f)))
    throw new Error("缺少必要字段：datetime, open, high, low, close, volume");
  if (lines.length > 20001) throw new Error("最多支持 20,000 行数据");
  const rows = lines.slice(1).map((line, index) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const get = (f: string) => cells[headers.indexOf(f)];
    const raw = get("datetime");
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        raw,
      )
    )
      throw new Error(`第 ${index + 2} 行时间请使用含时区的 ISO 格式`);
    const time = Date.parse(raw);
    const nums = fields
      .slice(1)
      .map((f) => (get(f) === "" ? NaN : Number(get(f))));
    const [open, high, low, close, volume] = nums;
    if (
      !Number.isFinite(time) ||
      time % 60000 !== 0 ||
      nums.some((n) => !Number.isFinite(n)) ||
      Math.min(open, high, low, close) <= 0 ||
      volume < 0 ||
      high < Math.max(open, close) ||
      low > Math.min(open, close) ||
      low > high
    )
      throw new Error(`第 ${index + 2} 行时间或 OHLCV 数据无效`);
    return {
      datetime: new Date(time).toISOString(),
      open,
      high,
      low,
      close,
      volume,
    };
  });
  for (let i = 1; i < rows.length; i++)
    if (
      Date.parse(rows[i].datetime) - Date.parse(rows[i - 1].datetime) !==
      60000
    )
      throw new Error(
        `第 ${i + 2} 行：请按时间升序提供连续的 1 分钟 K 线，不可重复或缺失`,
      );
  if (rows.length < 120)
    throw new Error("至少需要 120 根连续 1 分钟 K 线，用于趋势预热和回测");
  return rows;
}
export function displayTime(time: string) {
  return new Date(time).toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function displayDate(time: string) {
  return new Date(time).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
  });
}
