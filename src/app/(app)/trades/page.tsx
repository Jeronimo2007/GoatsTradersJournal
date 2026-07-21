"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { PlusCircle, Search } from "lucide-react";
import { fetchBootstrap } from "@/lib/api";
import type { Trade } from "@/lib/types";
import { formatMoney, formatDate, formatRR, tradeSession } from "@/lib/format";
import { realizedRR, outcome, computeStats } from "@/lib/stats";
import {
  PnL,
  DirectionBadge,
  OutcomeBadge,
  EmptyState,
} from "@/components/ui";
import clsx from "clsx";

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[] | undefined>(undefined);
  const [currency, setCurrency] = useState("USD");
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"all" | "long" | "short">("all");
  const [res, setRes] = useState<"all" | "win" | "loss" | "breakeven">("all");

  useEffect(() => {
    let cancelled = false;
    fetchBootstrap().then(({ settings, trades: all }) => {
      if (cancelled) return;
      setCurrency(settings.currency);
      setTrades(
        [...all].sort(
          (a, b) =>
            new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!trades) return [];
    return trades.filter((t) => {
      if (dir !== "all" && t.direction !== dir) return false;
      if (res !== "all" && outcome(t) !== res) return false;
      if (q.trim()) {
        const hay = `${t.asset} ${t.setups.join(" ")} ${t.postTradeReview}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [trades, dir, res, q]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);

  if (trades === undefined) {
    return <div className="text-muted">Cargando operaciones…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Operaciones</h1>
          <p className="text-sm text-muted">
            {trades.length} totales · {filtered.length} mostradas
          </p>
        </div>
        <Link href="/trades/new" className="btn btn-primary">
          <PlusCircle className="h-4 w-4" /> Nueva Operación
        </Link>
      </div>

      {trades.length === 0 ? (
        <EmptyState
          title="Aún no hay operaciones"
          description="Registra tu primera operación para empezar a construir tus estadísticas y revisar tu ventaja."
          action={
            <Link href="/trades/new" className="btn btn-primary">
              <PlusCircle className="h-4 w-4" /> Registra tu primera operación
            </Link>
          }
        />
      ) : (
        <>
          {/* Filters */}
          <div className="card p-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                className="field-input pl-9"
                placeholder="Buscar activo, configuración, notas…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <FilterGroup
              value={dir}
              onChange={(v) => setDir(v as typeof dir)}
              options={[
                ["all", "Todos"],
                ["long", "Largo"],
                ["short", "Corto"],
              ]}
            />
            <FilterGroup
              value={res}
              onChange={(v) => setRes(v as typeof res)}
              options={[
                ["all", "Todos"],
                ["win", "Ganadas"],
                ["loss", "Perdidas"],
                ["breakeven", "Empate"],
              ]}
            />
          </div>

          {/* Summary bar */}
          <div className="card px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Metric label="PnL Neto">
              <PnL value={stats.netPnl} format={(v) => formatMoney(v, currency)} />
            </Metric>
            <Metric label="Tasa de Ganancia">{stats.winRate.toFixed(1)}%</Metric>
            <Metric label="Factor de Beneficio">
              {stats.profitFactor === null ? "∞" : stats.profitFactor.toFixed(2)}
            </Metric>
            <Metric label="R:R Promedio">{formatRR(stats.avgRR)}</Metric>
            <Metric label="Expectativa">
              <PnL value={stats.expectancy} format={(v) => formatMoney(v, currency)} />
            </Metric>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-border">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Activo</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Sesión</th>
                    <th className="px-4 py-3 font-medium text-right">R:R</th>
                    <th className="px-4 py-3 font-medium text-right">PnL</th>
                    <th className="px-4 py-3 font-medium text-center">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/60 last:border-0 hover:bg-surface-2 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted">
                        <Link href={`/trades/${t.id}`} className="block">
                          {formatDate(t.closedAt)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/trades/${t.id}`} className="flex flex-col">
                          <span>{t.asset}</span>
                          {t.setups[0] && (
                            <span className="text-xs font-normal text-muted">
                              {t.setups[0]}
                              {t.setups.length > 1 ? ` +${t.setups.length - 1} más` : ""}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <DirectionBadge direction={t.direction} />
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {tradeSession(t)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {formatRR(realizedRR(t))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        <PnL
                          value={t.netPnl}
                          format={(v) => formatMoney(v, currency)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <OutcomeBadge outcome={outcome(t)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted">
                Ninguna operación coincide con tus filtros.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{children}</span>
    </div>
  );
}

function FilterGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden">
      {options.map(([val, label]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={clsx(
            "px-3 py-2 text-xs font-medium transition-colors",
            value === val
              ? "bg-accent/15 text-accent"
              : "text-muted hover:bg-surface-2"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
