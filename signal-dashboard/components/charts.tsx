"use client";
import {
  Area,
  Bar,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { displayTime } from "@/lib/engine";
export type CandleChartPoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  fast: number;
  slow: number;
};
type CandleShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: CandleChartPoint;
};
function CandleShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
}: CandleShapeProps) {
  if (!payload) return <g />;
  const { open, high, low, close } = payload;
  const span = high - low || 1;
  const color = close >= open ? "#96dfa9" : "#f29699";
  const bodyTop = y + ((high - Math.max(open, close)) / span) * height;
  const bodyHeight = Math.max(1, (Math.abs(open - close) / span) * height);
  return (
    <g>
      <line
        x1={x + width / 2}
        x2={x + width / 2}
        y1={y}
        y2={y + height}
        stroke={color}
      />
      <rect
        x={x}
        y={bodyTop}
        width={Math.max(1, width)}
        height={bodyHeight}
        fill={color}
        rx={0.5}
      />
    </g>
  );
}
export function PriceChart({
  data,
  showEma = true,
}: {
  data: CandleChartPoint[];
  showEma?: boolean;
}) {
  const candles = data.map((row) => ({ ...row, wick: [row.low, row.high] }));
  return (
    <div
      className="chart-box"
      role="img"
      aria-label="模拟 1 分钟 OHLC 蜡烛 K 线和 EMA 均线图"
    >
      <div className="chart-watermark">SIMULATED</div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={candles}
          margin={{ top: 10, right: 4, left: -12, bottom: 0 }}
          barCategoryGap="25%"
        >
          <CartesianGrid
            stroke="#242b35"
            strokeDasharray="3 4"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tickFormatter={displayTime}
            tick={{ fill: "#768195", fontSize: 10 }}
            minTickGap={50}
            axisLine={false}
            tickLine={false}
            tickMargin={12}
          />
          <YAxis
            domain={["dataMin - 20", "dataMax + 20"]}
            tick={{ fill: "#768195", fontSize: 10 }}
            tickFormatter={(n) =>
              Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })
            }
            axisLine={false}
            tickLine={false}
            width={66}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as CandleChartPoint;
              return (
                <div className="rounded-lg border border-border bg-card p-3 text-[11px] shadow-lg">
                  <p className="mb-2 text-muted">
                    {displayTime(String(label))} · 模拟数据
                  </p>
                  {[
                    ["开", row.open],
                    ["高", row.high],
                    ["低", row.low],
                    ["收", row.close],
                  ].map(([name, value]) => (
                    <p key={name} className="flex justify-between gap-6">
                      <span className="text-muted">{name}</span>
                      <span>{Number(value).toFixed(2)}</span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Bar
            dataKey="wick"
            name="模拟 K 线"
            isAnimationActive={false}
            shape={(props: unknown) => (
              <CandleShape {...(props as unknown as CandleShapeProps)} />
            )}
          />
          {showEma && (
            <>
              <Line
                name="快速 EMA"
                dataKey="fast"
                dot={false}
                stroke="#76aee7"
                strokeWidth={1.2}
                isAnimationActive={false}
              />
              <Line
                name="慢速 EMA"
                dataKey="slow"
                dot={false}
                stroke="#a79bd3"
                strokeWidth={1.2}
                isAnimationActive={false}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
export function EquityChart({
  data,
}: {
  data: { time: string; returnPct: number }[];
}) {
  return (
    <div className="chart-box" role="img" aria-label="研究回测累计收益曲线">
      <div className="chart-watermark">RESEARCH</div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8f277" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#c8f277" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#242b35"
            strokeDasharray="3 4"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tickFormatter={displayTime}
            tick={{ fill: "#768195", fontSize: 10 }}
            minTickGap={50}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(n) => `${Number(n).toFixed(1)}%`}
            tick={{ fill: "#768195", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#151c26",
              border: "1px solid #303947",
              borderRadius: 8,
              fontSize: 11,
            }}
            labelFormatter={(v) => displayTime(String(v)) + " · 研究用途"}
            formatter={(v: number) => [`${v.toFixed(3)}%`, "累计模拟收益"]}
          />
          <Area
            dataKey="returnPct"
            type="linear"
            stroke="#c8f277"
            strokeWidth={2}
            fill="url(#equityFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
