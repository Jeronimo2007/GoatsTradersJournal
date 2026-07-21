"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RrPoint } from "@/lib/backtest/stats";

const ACCENT = "#3b82f6";

export function RrCurveChart({ data }: { data: RrPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rrFill" x1="0" y1="0" x2="0" y2="1">
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
          tick={{ fill: "#8b93a1", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => `${Number(v).toFixed(1)}R`}
        />
        <ReferenceLine y={0} stroke="#3a4453" />
        <Tooltip
          contentStyle={{
            background: "#12161c",
            border: "1px solid #232a34",
            borderRadius: 8,
            color: "#e6e9ef",
            fontSize: 12,
          }}
          formatter={(value) => [`${Number(value).toFixed(2)}R`, "Acumulado"]}
        />
        <Area
          type="monotone"
          dataKey="cumRR"
          stroke={ACCENT}
          strokeWidth={2}
          fill="url(#rrFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
