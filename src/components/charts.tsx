"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint, GroupStat } from "@/lib/stats";

const PROFIT = "#16c784";
const LOSS = "#f6465d";
const ACCENT = "#3b82f6";

export function EquityChart({
  data,
  currency,
}: {
  data: EquityPoint[];
  currency: string;
}) {
  const symbol = currency === "USD" ? "$" : "";

  // Frame the Y-axis tightly around the actual equity values. With a large
  // starting balance (e.g. $50k) and small per-trade P/L, the default scale
  // makes the curve look flat, so we pad the observed range instead.
  const equities = data.map((d) => d.equity);
  const min = equities.length ? Math.min(...equities) : 0;
  const max = equities.length ? Math.max(...equities) : 0;
  const range = max - min;
  const pad = range === 0 ? Math.max(Math.abs(max) * 0.01, 1) : range * 0.08;
  const domain: [number, number] = [min - pad, max + pad];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#232a34" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#8b93a1", fontSize: 11 }}
          axisLine={{ stroke: "#232a34" }}
          tickLine={false}
        />
        <YAxis
          domain={domain}
          allowDecimals
          tick={{ fill: "#8b93a1", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={72}
          tickFormatter={(v) =>
            `${symbol}${Number(v).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}`
          }
        />
        <Tooltip
          contentStyle={{
            background: "#12161c",
            border: "1px solid #232a34",
            borderRadius: 8,
            color: "#e6e9ef",
            fontSize: 12,
          }}
          formatter={(value) => [
            `${symbol}${Number(value).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}`,
            "Equity",
          ]}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke={ACCENT}
          strokeWidth={2}
          fill="url(#equityFill)"
          baseValue={domain[0]}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function GroupBarChart({
  data,
  currency,
}: {
  data: GroupStat[];
  currency: string;
}) {
  const symbol = currency === "USD" ? "$" : "";
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 44)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#232a34" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "#8b93a1", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${symbol}${Number(v).toLocaleString()}`}
        />
        <YAxis
          type="category"
          dataKey="key"
          tick={{ fill: "#8b93a1", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            background: "#12161c",
            border: "1px solid #232a34",
            borderRadius: 8,
            color: "#e6e9ef",
            fontSize: 12,
          }}
          formatter={(value) => [
            `${symbol}${Number(value).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}`,
            "Net PnL",
          ]}
        />
        <Bar dataKey="netPnl" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.netPnl >= 0 ? PROFIT : LOSS} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
