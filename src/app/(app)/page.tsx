"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlusCircle, TrendingUp, TrendingDown, Flame } from "lucide-react";
import { fetchBootstrap } from "@/lib/api";
import type { Trade } from "@/lib/types";
import {
  computeStats,
  equityCurve,
  statsBySession,
  statsBySetup,
  statsByAsset,
  outcome,
} from "@/lib/stats";
import { formatMoney, formatRR, formatDate } from "@/lib/format";
import { StatCard, PnL, EmptyState, DirectionBadge, OutcomeBadge } from "@/components/ui";
import dynamic from "next/dynamic";

const EquityChart = dynamic(
  () => import("@/components/charts").then((m) => m.EquityChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-lg bg-surface-2" />
    ),
  }
);
const GroupBarChart = dynamic(
  () => import("@/components/charts").then((m) => m.GroupBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 animate-pulse rounded-lg bg-surface-2" />
    ),
  }
);

export default function DashboardPage() {
  const [trades, setTrades] = useState<Trade[] | undefined>(undefined);
  const [currency, setCurrency] = useState("USD");
  const [balance, setBalance] = useState(10000);

  useEffect(() => {
    let cancelled = false;
    fetchBootstrap().then(({ settings, trades: list }) => {
      if (cancelled) return;
      setCurrency(settings.currency);
      setBalance(settings.accountBalance);
      setTrades(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => computeStats(trades ?? []), [trades]);
  const curve = useMemo(
    () => equityCurve(trades ?? [], balance),
    [trades, balance]
  );
  const bySession = useMemo(() => statsBySession(trades ?? []), [trades]);
  const bySetup = useMemo(() => statsBySetup(trades ?? []), [trades]);
  const byAsset = useMemo(() => statsByAsset(trades ?? []), [trades]);
  const recent = useMemo(
    () =>
      [...(trades ?? [])]
        .sort(
          (a, b) =>
            new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
        )
        .slice(0, 5),
    [trades]
  );

  const money = (v: number) => formatMoney(v, currency);

  if (trades === undefined) return <div className="text-muted">Cargando…</div>;

  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Panel</h1>
        <EmptyState
          title="Bienvenido a tu Diario de Trading"
          description="Registra operaciones para desbloquear tu tasa de ganancias, factor de beneficio, análisis de R:R, curva de capital y revisión psicológica."
          action={
            <Link href="/trades/new" className="btn btn-primary">
              <PlusCircle className="h-4 w-4" /> Registrar tu primera operación
            </Link>
          }
        />
      </div>
    );
  }

  const streak = stats.currentStreak;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Panel</h1>
          <p className="text-sm text-muted">
            {stats.count} operaciones · {stats.wins}G / {stats.losses}P
            {stats.breakevens ? ` / ${stats.breakevens}PE` : ""}
          </p>
        </div>
        <Link href="/trades/new" className="btn btn-primary">
          <PlusCircle className="h-4 w-4" /> Nueva Operación
        </Link>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="PnL Neto"
          value={<PnL value={stats.netPnl} format={money} />}
          hint={`Después de ${money(stats.totalFees)} en comisiones`}
          tone={stats.netPnl >= 0 ? "profit" : "loss"}
        />
        <StatCard
          label="Tasa de Ganancia"
          value={`${stats.winRate.toFixed(1)}%`}
          hint={`${stats.wins}G / ${stats.losses}P`}
        />
        <StatCard
          label="Factor de Beneficio"
          value={stats.profitFactor === null ? "∞" : stats.profitFactor.toFixed(2)}
          hint="Beneficio bruto ÷ pérdida bruta"
        />
        <StatCard
          label="Expectativa / Operación"
          value={<PnL value={stats.expectancy} format={money} />}
          hint="Resultado promedio esperado"
          tone={stats.expectancy >= 0 ? "profit" : "loss"}
        />
        <StatCard label="R:R Promedio" value={formatRR(stats.avgRR)} hint="Recompensa:riesgo realizada" />
        <StatCard
          label="Ganancia / Pérdida Promedio"
          value={
            <span className="text-base">
              <span className="text-profit">{money(stats.avgWin)}</span>
              <span className="text-muted"> / </span>
              <span className="text-loss">-{money(stats.avgLoss).replace(/^-/, "")}</span>
            </span>
          }
        />
        <StatCard
          label="Reducción Máxima (Drawdown)"
          value={money(stats.maxDrawdown)}
          hint="De pico a valle"
          tone="loss"
        />
        <StatCard
          label="Racha Actual"
          value={
            <span className="flex items-center gap-2">
              {streak.type === "win" ? (
                <TrendingUp className="h-5 w-5 text-profit" />
              ) : streak.type === "loss" ? (
                <TrendingDown className="h-5 w-5 text-loss" />
              ) : (
                <Flame className="h-5 w-5 text-muted" />
              )}
              {streak.length} {streak.type === "win" ? "ganadas" : streak.type === "loss" ? "perdidas" : ""}
            </span>
          }
        />
      </div>

      {/* Equity curve */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">
          Curva de Capital
        </h2>
        <EquityChart data={curve} currency={currency} />
      </div>

      {/* Session + Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">
            PnL por Sesión
          </h2>
          <GroupBarChart data={bySession} currency={currency} />
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">
            PnL por Configuración
          </h2>
          {bySetup.length ? (
            <GroupBarChart data={bySetup} currency={currency} />
          ) : (
            <p className="text-sm text-muted">No hay configuraciones etiquetadas aún.</p>
          )}
        </div>
      </div>

      {/* Asset table + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">
            Por Activo
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted">
                <th className="pb-2 font-medium">Activo</th>
                <th className="pb-2 font-medium text-right">Operaciones</th>
                <th className="pb-2 font-medium text-right">Ganancia %</th>
                <th className="pb-2 font-medium text-right">PnL Neto</th>
              </tr>
            </thead>
            <tbody>
              {byAsset.map((a) => (
                <tr key={a.key} className="border-t border-border/60">
                  <td className="py-2 font-medium">{a.key}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{a.count}</td>
                  <td className="py-2 text-right tabular-nums text-muted">
                    {a.winRate.toFixed(0)}%
                  </td>
                  <td className="py-2 text-right tabular-nums font-semibold">
                    <PnL value={a.netPnl} format={money} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Operaciones Recientes
            </h2>
            <Link href="/trades" className="text-xs text-accent hover:underline">
              Ver todo
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map((t) => (
              <Link
                key={t.id}
                href={`/trades/${t.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <OutcomeBadge outcome={outcome(t)} />
                  <div>
                    <div className="font-medium">{t.asset}</div>
                    <div className="text-xs text-muted">
                      {formatDate(t.closedAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DirectionBadge direction={t.direction} />
                  <span className="font-semibold tabular-nums w-24 text-right">
                    <PnL value={t.netPnl} format={money} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
