"use client";

import { useEffect, useMemo } from "react";
import clsx from "clsx";
import {
  X,
  Zap,
  Pencil,
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  Minus,
} from "lucide-react";
import type {
  BacktestTrade,
  BacktestSettings,
  BtSession,
  BtOutcome,
} from "@/lib/backtest/types";
import { BT_SESSIONS } from "@/lib/backtest/types";
import { computeStats, dayKey, resolvedPnl } from "@/lib/backtest/stats";
import { formatMoney } from "@/lib/format";

const OUTCOME_BADGE: Record<
  BtOutcome,
  { label: string; cls: string; icon: typeof Trophy }
> = {
  win: { label: "GANADA", cls: "bg-profit/15 text-profit", icon: Trophy },
  loss: { label: "PERDIDA", cls: "bg-loss/15 text-loss", icon: Target },
  be: { label: "PE", cls: "bg-muted/15 text-muted", icon: Minus },
};

function prettyDate(key: string): string {
  const d = new Date(`${key}T12:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("es", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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

function Money({
  value,
  money,
}: {
  value: number;
  money: (v: number) => string;
}) {
  return (
    <span
      className={clsx(
        "tabular-nums",
        value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-muted"
      )}
    >
      {money(value)}
    </span>
  );
}

function SessionBreakdown({
  session,
  trades,
  settings,
  money,
}: {
  session: BtSession;
  trades: BacktestTrade[];
  settings: BacktestSettings;
  money: (v: number) => string;
}) {
  const stats = computeStats(trades, settings.riskPerTrade);
  const empty = trades.length === 0;
  return (
    <div
      className={clsx(
        "card p-4",
        empty
          ? "border-border"
          : stats.netPnl > 0
            ? "border-profit/30"
            : stats.netPnl < 0
              ? "border-loss/30"
              : "border-border"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold">{session}</div>
        <div className="text-xs text-muted">{stats.count} operaciones</div>
      </div>
      {empty ? (
        <p className="mt-3 text-sm text-muted">No hay operaciones de {session} este día.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <div>
              <div className="text-base font-semibold">
                <Money value={stats.netPnl} money={money} />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted">
                Beneficio
              </div>
            </div>
            <div>
              <div className="text-base font-semibold tabular-nums">
                {stats.winRate.toFixed(0)}%
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted">
                Tasa de ganancia
              </div>
            </div>
            <div>
              <div className="text-base font-semibold">
                <RR value={stats.totalRR} />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted">
                R Total
              </div>
            </div>
            <div>
              <div className="text-base font-semibold">
                <RR value={stats.avgRR} />
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted">
                R Promedio
              </div>
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-muted">
            {stats.wins}G / {stats.losses}P
            {stats.breakevens ? ` / ${stats.breakevens}PE` : ""}
          </div>
        </>
      )}
    </div>
  );
}

export function DayDetailModal({
  dateKey,
  trades,
  settings,
  onClose,
  onQuickLog,
  onEdit,
}: {
  dateKey: string | null;
  trades: BacktestTrade[];
  settings: BacktestSettings;
  onClose: () => void;
  onQuickLog: (dateStr: string) => void;
  onEdit: (trade: BacktestTrade) => void;
}) {
  useEffect(() => {
    if (!dateKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [dateKey, onClose]);

  const dayTrades = useMemo(
    () =>
      dateKey
        ? trades
            .filter((t) => dayKey(t.date) === dateKey)
            .sort((a, b) => b.id - a.id)
        : [],
    [trades, dateKey]
  );

  const bySession = useMemo(() => {
    const map: Record<BtSession, BacktestTrade[]> = { NY: [], Tokyo: [] };
    for (const t of dayTrades) map[t.session].push(t);
    return map;
  }, [dayTrades]);

  if (!dateKey) return null;

  const money = (v: number) => formatMoney(v, settings.currency);
  const dayStats = computeStats(dayTrades, settings.riskPerTrade);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="card relative z-10 my-4 w-full max-w-2xl p-5 sm:p-6">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{prettyDate(dateKey)}</h2>
            <p className="text-xs text-muted">Análisis del día · NY vs Tokio</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Day totals — profit first */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-center">
            <div className="text-lg font-semibold">
              <Money value={dayStats.netPnl} money={money} />
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted">
              Beneficio
            </div>
          </div>
          <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-center">
            <div className="text-lg font-semibold">
              <RR value={dayStats.totalRR} />
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted">
              R Total
            </div>
          </div>
          <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-center">
            <div className="text-lg font-semibold tabular-nums">
              {dayStats.winRate.toFixed(0)}%
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted">
              Tasa de ganancia
            </div>
          </div>
          <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-center">
            <div className="text-lg font-semibold tabular-nums">
              {dayStats.count}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted">
              Operaciones
            </div>
          </div>
        </div>

        {/* Session breakdown */}
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
          Por sesión
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BT_SESSIONS.map((s) => (
            <SessionBreakdown
              key={s}
              session={s}
              trades={bySession[s]}
              settings={settings}
              money={money}
            />
          ))}
        </div>

        {/* Trades of the day */}
        {dayTrades.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Operaciones
            </h3>
            <div className="space-y-2">
              {dayTrades.map((t) => {
                const badge = OUTCOME_BADGE[t.outcome];
                const BadgeIcon = badge.icon;
                const DirIcon =
                  t.direction === "long" ? TrendingUp : TrendingDown;
                const pnl = resolvedPnl(t, settings.riskPerTrade);
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2"
                  >
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
                        badge.cls
                      )}
                    >
                      <BadgeIcon className="h-3 w-3" />
                      {badge.label}
                    </span>
                    <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-muted">
                      {t.session}
                    </span>
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 text-xs font-semibold",
                        t.direction === "long" ? "text-profit" : "text-loss"
                      )}
                    >
                      <DirIcon className="h-3 w-3" />
                      {t.direction === "long" ? "LARGO" : "CORTO"}
                    </span>
                    {t.asset && (
                      <span className="text-xs font-medium">{t.asset}</span>
                    )}
                    <div className="ml-auto text-right">
                      <div className="text-sm font-semibold">
                        <Money value={pnl} money={money} />
                      </div>
                      <div
                        className={clsx(
                          "text-[11px] tabular-nums",
                          t.rr > 0
                            ? "text-profit"
                            : t.rr < 0
                              ? "text-loss"
                              : "text-muted"
                        )}
                      >
                        {t.rr >= 0 ? "+" : ""}
                        {t.rr.toFixed(1)}R
                      </div>
                    </div>
                    <button
                      onClick={() => onEdit(t)}
                      className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => onQuickLog(dateKey)}
            className="btn btn-primary"
          >
            <Zap className="h-4 w-4" /> Registrar una operación para este día
          </button>
        </div>
      </div>
    </div>
  );
}
