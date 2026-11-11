"use client";
import {
  Area,
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
export function PriceChart({
  data,
  showEma = true,
}: {
  data: { time: string; price: number; fast: number; slow: number }[];
  showEma?: boolean;
}) {
  return (
    <div
      className="chart-box"
      role="img"
      aria-label="模拟价格和 EMA 均线走势图"
    >
      <div className="chart-watermark">SIMULATED</div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 4, left: -12, bottom: 0 }}
        >
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8f277" stopOpacity={0.17} />
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
            axisLine={false}
            tickLine={false}
            tickMargin={12}
          />
          <YAxis
            domain={["dataMin - 70", "dataMax + 70"]}
            tick={{ fill: "#768195", fontSize: 10 }}
            tickFormatter={(n) =>
              Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })
            }
            axisLine={false}
            tickLine={false}
            width={66}
          />
          <Tooltip
            contentStyle={{
              background: "#151c26",
              border: "1px solid #303947",
              borderRadius: 8,
              fontSize: 11,
            }}
            labelFormatter={(v) => displayTime(String(v)) + " · 模拟数据"}
            formatter={(value: number, name: string) => [
              value.toFixed(2),
              name,
            ]}
          />
          <Area
            name="模拟价格"
            type="linear"
            dataKey="price"
            stroke="#c8f277"
            strokeWidth={2}
            fill="url(#priceFill)"
            isAnimationActive={false}
          />
          {showEma && (
            <>
              <Line
                name="快速 EMA"
                dataKey="fast"
                dot={false}
                stroke="#76aee7"
                strokeWidth={1}
                isAnimationActive={false}
              />
              <Line
                name="慢速 EMA"
                dataKey="slow"
                dot={false}
                stroke="#a79bd3"
                strokeWidth={1}
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
