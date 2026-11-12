"use client";
import {AdvancedFilters} from "@/components/advanced-filters";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useResearch } from "@/components/provider";
import {
  analyze,
  defaults,
  labels,
  validateParams,
  type Params,
} from "@/lib/engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
const fields: {
  key: Exclude<keyof Params, "trendEnabled"|"adxEnabled"|"atrEnabled"|"deviationEnabled">;
  name: string;
  min: number;
  max: number;
  step: number;
  note: string;
}[] = [
  {
    key: "trend",
    name: "5 分钟趋势 EMA 周期",
    min: 2,
    max: 100,
    step: 1,
    note: "仅使用已收盘的完整 5 分钟 K 线",
  },
  {
    key: "fast",
    name: "1 分钟快速 EMA 周期",
    min: 2,
    max: 50,
    step: 1,
    note: "捕捉短周期动量变化",
  },
  {
    key: "slow",
    name: "1 分钟慢速 EMA 周期",
    min: 3,
    max: 100,
    step: 1,
    note: "应大于快速均线周期",
  },
  {
    key: "rsi",
    name: "RSI 周期",
    min: 2,
    max: 50,
    step: 1,
    note: "使用 Wilder 平滑计算",
  },
  {
    key: "rsiMin",
    name: "RSI 合理区间下限",
    min: 0,
    max: 99,
    step: 1,
    note: "低于此值的信号将被过滤",
  },
  {
    key: "rsiMax",
    name: "RSI 合理区间上限",
    min: 1,
    max: 100,
    step: 1,
    note: "高于此值的信号将被过滤",
  },
  {
    key: "volumePeriod",
    name: "成交量均值周期",
    min: 2,
    max: 100,
    step: 1,
    note: "使用当前 K 线之前的均量，不含当前根",
  },
  {
    key: "volumeMultiplier",
    name: "成交量放大倍数",
    min: 0.5,
    max: 5,
    step: 0.1,
    note: "当前成交量须严格大于均量 × 此倍数",
  },
];
export default function Rules() {
  const { params, save, rows } = useResearch();
  const [draft, setDraft] = useState(params);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(params), [params]);
  const error = validateParams(draft);
  const signals = useMemo(
    () => (error ? [] : analyze(rows, draft)),
    [rows, draft, error],
  );
  const signal = signals.at(-1);
  function update(key: keyof Params, value: number | boolean) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (!validateParams(next)) {
      save(next);
      setSaved(true);
    } else setSaved(false);
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <div className="eyebrow">STRATEGY SETTINGS / 策略实验室</div>
          <h1 className="page-title">让每一个信号，有据可循。</h1>
          <p className="page-desc">
            有效参数会同时应用到首页币安研究信号；此页使用模拟数据预览规则变化。
          </p>
        </div>
        <Badge className="mt-5">研究用途</Badge>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-primary" />
              <CardTitle>信号参数</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4">
              <div>
                <label htmlFor="trend-enabled" className="text-xs">
                  启用 5 分钟趋势过滤
                </label>
                <p className="mt-2 text-[10px] text-muted">
                  关闭后仅使用 EMA 交叉、RSI 与成交量条件；有效参数立即应用。
                </p>
              </div>
              <Switch
                id="trend-enabled"
                checked={draft.trendEnabled}
                onCheckedChange={(value) => update("trendEnabled", value)}
              />
            </div>
            <div className="grid gap-x-8 gap-y-7 pt-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label htmlFor={f.key} className="text-xs">
                      {f.name}
                    </label>
                    <Input
                      id={f.key}
                      type="number"
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      value={Number.isNaN(draft[f.key]) ? "" : draft[f.key]}
                      onChange={(e) =>
                        update(
                          f.key,
                          e.target.value === "" ? NaN : Number(e.target.value),
                        )
                      }
                      className="h-8 w-20 text-right"
                    />
                  </div>
                  <input
                    aria-label={`${f.name}滑块`}
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={Number.isFinite(draft[f.key]) ? draft[f.key] : f.min}
                    onChange={(e) => update(f.key, Number(e.target.value))}
                  />
                  <p className="mt-3 text-[10px] text-muted">{f.note}</p>
                </div>
              ))}
            </div>
            <AdvancedFilters params={draft} onChange={update}/>
            <div className="mt-8 border-t border-border pt-5">
              {error && (
                <p role="alert" className="mb-4 text-xs text-negative">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={!!error}
                  onClick={() => {
                    save(draft);
                    setSaved(true);
                  }}
                >
                  <Save size={14} />
                  确认当前参数
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraft(defaults);
                    save(defaults);
                    setSaved(true);
                  }}
                >
                  <RotateCcw size={14} />
                  恢复默认参数
                </Button>
                {saved && (
                  <span role="status" className="text-xs text-positive">
                    有效参数已自动应用并保存
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>模拟信号预览</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge>同一组固定模拟数据</Badge>
              <div
                className={`my-5 text-4xl font-semibold signal-${signal?.direction ?? "neutral"}`}
              >
                {signal ? labels[signal.direction] : "参数无效"}
              </div>
              <p className="text-xs leading-6 text-muted">
                当前参数在 1,440 根模拟 K 线中触发{" "}
                <span className="text-foreground">
                  {error
                    ? "—"
                    : signals.filter((s) => s.direction !== "neutral").length}
                </span>{" "}
                次信号。预览随参数变化即时重算，有效修改即时应用到其他页面。
              </p>
              <Button asChild variant="outline" className="mt-5 w-full">
                <Link href="/">
                  返回仪表盘 <ArrowRight size={14} />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>四层过滤机制</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-5 text-xs">
                {[
                  "5 分钟趋势：价格在已收盘 EMA 上方只看涨，下方只看跌；开关关闭时不限制方向。",
                  "1 分钟触发：快速 EMA 在当前收盘上穿或下穿慢速 EMA，方向须与趋势一致。",
                  "RSI 过滤：数值须在设置的上下限内（含边界）。",
                  "成交量确认：成交量须严格大于前 N 根均量 × 倍数。",
                ].map((s, i) => (
                  <li key={s} className="flex gap-3 leading-6 text-muted">
                    <span className="text-primary">0{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
