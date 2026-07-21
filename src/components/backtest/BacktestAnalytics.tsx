"use client";

import { useMemo } from "react";
import clsx from "clsx";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import type { BacktestTrade, BacktestSettings } from "@/lib/backtest/types";
import {
  computeStats,
  statsBySession,
  statsByDirection,
  statsBySetup,
  buildInsights,
  rrCurve,
  type BtGroupStat,
  type Insight,
} from "@/lib/backtest/stats";
import { StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { RrCurveChart } from "./BacktestCharts";

function RR({ value }: { value: number }) {
  return (
    <span
      className={clsx(
        "tabular-nums",
        value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-muted"
      )}
    >
      {value >= 0 ? "+" : ""}
      {value.toFixed(2)}R
    </span>
  );
}

function GroupCard({
  stat,
  money,
  accent,
}: {
  stat: BtGroupStat;
  money: (v: number) => string;
  accent?: "profit" | "loss" | "accent";
}) {
  const border =
    accent === "profit"
      ? "border-profit/30"
      : accent === "loss"
        ? "border-loss/30"
        : "border-border";
  return (
    <div className={clsx("card p-4", border)}>
      <div className="flex items-center justify-between">
        <div className="font-semibold">{stat.key}</div>
        <div className="text-xs text-muted">{stat.count} trades</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-semibold tabular-nums">
            {stat.winRate.toFixed(0)}%
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted">
                Tasa de ganancia
          </div>
        </div>
        <div>
          <div className="text-lg font-semibold">
            <RR value={stat.avgRR} />
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted">
                R Promedio
          </div>
        </div>
        <div>
          <div className="text-lg font-semibold">
            <RR value={stat.totalRR} />
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted">
                R Total
          </div>
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-muted">
        Net{" "}
        <span
          className={clsx(
            "font-semibold tabular-nums",
            stat.netPnl > 0
              ? "text-profit"
              : stat.netPnl < 0
                ? "text-loss"
                : "text-muted"
          )}
        >
          {money(stat.netPnl)}
        </span>{" "}
        · {stat.wins}W / {stat.losses}L
        {stat.breakevens ? ` / ${stat.breakevens}BE` : ""}
      </div>
    </div>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const Icon =
    insight.tone === "good"
      ? TrendingUp
      : insight.tone === "bad"
        ? AlertTriangle
        : Lightbulb;
  const tone =
    insight.tone === "good"
      ? "border-profit/30 bg-profit/5 text-profit"
      : insight.tone === "bad"
        ? "border-loss/30 bg-loss/5 text-loss"
        : "border-accent/30 bg-accent/5 text-accent";
  return (
    <div className={clsx("flex gap-3 rounded-lg border px-4 py-3", tone)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-sm text-foreground">{insight.text}</p>
    </div>
  );
}

export function BacktestAnalytics({
  trades,
  settings,
}: {
  trades: BacktestTrade[];
  settings: BacktestSettings;
}) {
  const risk = settings.riskPerTrade;
  const money = (v: number) => formatMoney(v, settings.currency);

  const stats = useMemo(() => computeStats(trades, risk), [trades, risk]);
  const bySession = useMemo(() => statsBySession(trades, risk), [trades, risk]);
  const byDirection = useMemo(
    () => statsByDirection(trades, risk),
    [trades, risk]
  );
  const bySetup = useMemo(() => statsBySetup(trades, risk), [trades, risk]);
  const insights = useMemo(() => buildInsights(trades, risk), [trades, risk]);
  const curve = useMemo(() => rrCurve(trades), [trades]);

  const long = byDirection.find((d) => d.key === "Long");
  const short = byDirection.find((d) => d.key === "Short");

  return (
    <div className="space-y-6">
      {/* 1. Global metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Tasa de Ganancia"
          value={`${stats.winRate.toFixed(1)}%`}
          hint={`${stats.wins}G / ${stats.losses}P${stats.breakevens ? ` / ${stats.breakevens}PE` : ""}`}
        />
        <StatCard label="Total Operaciones" value={stats.count} hint="Replays registrados" />
        <StatCard
          label="R:R Total"
          value={
            <span
              className={
                stats.totalRR > 0
                  ? "text-profit"
                  : stats.totalRR < 0
                    ? "text-loss"
                    : ""
              }
            >
              {stats.totalRR >= 0 ? "+" : ""}
              {stats.totalRR.toFixed(1)}R
            </span>
          }
          hint="Suma de R realizada"
        />
        <StatCard
          label="R Promedio / Operación"
          value={
            <span
              className={
                stats.avgRR > 0
                  ? "text-profit"
                  : stats.avgRR < 0
                    ? "text-loss"
                    : ""
              }
            >
              {stats.avgRR >= 0 ? "+" : ""}
              {stats.avgRR.toFixed(2)}R
            </span>
          }
          hint="Expectativa en R"
        />
        <StatCard
          label="P/L Neto"
          value={money(stats.netPnl)}
          hint={`Con ${money(risk)} de riesgo/operación`}
          tone={stats.netPnl >= 0 ? "profit" : "loss"}
        />
      </div>

      {/* Cumulative R curve */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Curva R Acumulada
        </h2>
        {trades.length ? (
          <RrCurveChart data={curve} />
        ) : (
          <p className="py-10 text-center text-sm text-muted">
            Aún no hay operaciones registradas.
          </p>
        )}
      </div>

      {/* 2. Session analysis */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
          Análisis de Sesión · NY vs Tokio
        </h2>
        {bySession.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {bySession.map((s, i) => (
              <GroupCard
                key={s.key}
                stat={s}
                money={money}
                accent={i === 0 ? "profit" : undefined}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Aún no hay datos.</p>
        )}
      </div>

      {/* 3. Directional analysis */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
          Análisis Direccional · Largos vs Cortos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {long ? (
            <GroupCard stat={long} money={money} />
          ) : (
            <div className="card flex items-center gap-2 p-4 text-sm text-muted">
              <TrendingUp className="h-4 w-4" /> Aún no hay operaciones largas.
            </div>
          )}
          {short ? (
            <GroupCard stat={short} money={money} />
          ) : (
            <div className="card flex items-center gap-2 p-4 text-sm text-muted">
              <TrendingDown className="h-4 w-4" /> Aún no hay operaciones cortas.
            </div>
          )}
        </div>
      </div>

      {/* 4. Setup breakdown */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
          Desglose de Configuración / Estrategia
        </h2>
        {bySetup.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted">
                  <th className="pb-2 font-medium">Configuración</th>
                  <th className="pb-2 text-right font-medium">Operaciones</th>
                  <th className="pb-2 text-right font-medium">Ganancia %</th>
                  <th className="pb-2 text-right font-medium">R Promedio</th>
                  <th className="pb-2 text-right font-medium">R Total</th>
                  <th className="pb-2 text-right font-medium">P/L Neto</th>
                </tr>
              </thead>
              <tbody>
                {bySetup.map((s) => (
                  <tr key={s.key} className="border-t border-border/60">
                    <td className="py-2 font-medium">{s.key}</td>
                    <td className="py-2 text-right tabular-nums text-muted">
                      {s.count}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted">
                      {s.winRate.toFixed(0)}%
                    </td>
                    <td className="py-2 text-right font-semibold">
                      <RR value={s.avgRR} />
                    </td>
                    <td className="py-2 text-right font-semibold">
                      <RR value={s.totalRR} />
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">
                      <span
                        className={
                          s.netPnl > 0
                            ? "text-profit"
                            : s.netPnl < 0
                              ? "text-loss"
                              : "text-muted"
                        }
                      >
                        {money(s.netPnl)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Etiqueta tus operaciones con configuraciones para desbloquear este desglose.
          </p>
        )}
      </div>

      {/* 5. Insights */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-warning" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-warning">
            Insights y Sugerencias
          </h2>
        </div>
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <InsightRow key={i} insight={ins} />
          ))}
        </div>
      </div>
    </div>
  );
}
