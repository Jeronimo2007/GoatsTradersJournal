"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { BacktestTrade, BacktestSettings } from "@/lib/backtest/types";
import { aggregateByDay, type DayAgg } from "@/lib/backtest/stats";
import { formatMoney, currencySymbol } from "@/lib/format";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function keyFor(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function todayKey(): string {
  const d = new Date();
  return keyFor(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Build a 6-row (Mon-first) grid of day cells for the given month. */
function buildGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // JS: 0=Sun..6=Sat. Convert to Mon-first offset (0=Mon..6=Sun).
  const offset = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function BacktestCalendar({
  trades,
  settings,
  onDayClick,
}: {
  trades: BacktestTrade[];
  settings: BacktestSettings;
  onDayClick: (dateStr: string) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const byDay = useMemo(
    () => aggregateByDay(trades, settings.riskPerTrade),
    [trades, settings.riskPerTrade]
  );
  const grid = useMemo(() => buildGrid(year, month), [year, month]);

  const monthAgg = useMemo(() => {
    let count = 0;
    let netRR = 0;
    let netPnl = 0;
    let wins = 0;
    let losses = 0;
    for (const [k, agg] of byDay) {
      if (k.startsWith(`${year}-${pad(month + 1)}-`)) {
        count += agg.count;
        netRR += agg.netRR;
        netPnl += agg.netPnl;
        wins += agg.wins;
        losses += agg.losses;
      }
    }
    return { count, netRR, netPnl, wins, losses };
  }, [byDay, year, month]);

  const money = (v: number) => formatMoney(v, settings.currency);
  // Compact money for the tight day cells: no cents, e.g. "+$350".
  const compactMoney = (v: number) => {
    const sign = v < 0 ? "-" : v > 0 ? "+" : "";
    return `${sign}${currencySymbol(settings.currency)}${Math.abs(
      Math.round(v)
    ).toLocaleString()}`;
  };
  const tKey = todayKey();

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const monthName = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const cellTone = (agg: DayAgg | undefined) => {
    if (!agg) return "border-border hover:border-accent/50 hover:bg-surface-2";
    if (agg.netPnl > 0)
      return "border-profit/40 bg-profit/10 hover:bg-profit/20";
    if (agg.netPnl < 0) return "border-loss/40 bg-loss/10 hover:bg-loss/20";
    return "border-border bg-surface-2";
  };

  return (
    <div className="space-y-4">
      {/* Header + month navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-md border border-border p-2 text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-40 text-center text-base font-semibold">
            {monthName}
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-md border border-border p-2 text-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setYear(now.getFullYear());
              setMonth(now.getMonth());
            }}
            className="btn btn-ghost ml-1 !py-1.5 !px-3 text-xs"
          >
            Hoy
          </button>
        </div>

        {/* Month summary — profit first */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-surface-2 px-3 py-1.5 text-muted">
            {monthAgg.count} operaciones
          </span>
          <span className="rounded-lg bg-surface-2 px-3 py-1.5">
            <span className="text-muted">Beneficio </span>
            <span
              className={clsx(
                "font-semibold tabular-nums",
                monthAgg.netPnl > 0
                  ? "text-profit"
                  : monthAgg.netPnl < 0
                    ? "text-loss"
                    : "text-muted"
              )}
            >
              {money(monthAgg.netPnl)}
            </span>
          </span>
          <span className="rounded-lg bg-surface-2 px-3 py-1.5 text-muted">
            {monthAgg.netRR >= 0 ? "+" : ""}
            {monthAgg.netRR.toFixed(1)}R
          </span>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted"
          >
            {w}
          </div>
        ))}

        {/* Day cells */}
        {grid.map((day, i) => {
          if (day === null)
            return <div key={`empty-${i}`} className="min-h-20" />;
          const key = keyFor(year, month, day);
          const agg = byDay.get(key);
          const isToday = key === tKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDayClick(key)}
              title={
                agg
                  ? `${agg.count} operaciones · ${money(agg.netPnl)}`
                  : "Ver análisis del día / registrar una operación"
              }
              className={clsx(
                "group relative flex min-h-20 flex-col rounded-lg border p-1.5 text-left transition-colors",
                cellTone(agg)
              )}
            >
              <span
                className={clsx(
                  "text-xs font-semibold",
                  isToday
                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white"
                    : "text-muted"
                )}
              >
                {day}
              </span>

              {agg ? (
                <span className="mt-auto space-y-0.5">
                  <span
                    className={clsx(
                      "block text-sm font-bold tabular-nums",
                      agg.netPnl > 0
                        ? "text-profit"
                        : agg.netPnl < 0
                          ? "text-loss"
                          : "text-muted"
                    )}
                  >
                    {compactMoney(agg.netPnl)}
                  </span>
                  <span className="block text-[10px] text-muted">
                    {agg.count} {agg.count === 1 ? "operación" : "operaciones"}
                  </span>
                </span>
              ) : (
                <span className="mt-auto flex items-center gap-1 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
                  <Plus className="h-3 w-3" /> Registrar
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-profit/40 bg-profit/20" />
          Día rentable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-loss/40 bg-loss/20" />
          Día de pérdida
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-border bg-surface-2" />
          Punto de equilibrio / sin operaciones
        </span>
        <span className="ml-auto">Toca cualquier día para ver su desglose de NY / Tokio.</span>
      </div>
    </div>
  );
}
