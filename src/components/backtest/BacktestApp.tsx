"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Zap,
  History,
  CalendarDays,
  BarChart3,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  Minus,
} from "lucide-react";
import {
  fetchBacktests,
  deleteBacktest as apiDelete,
  fetchBacktestSettings,
  saveBacktestSettings,
} from "@/lib/backtest/api";
import type {
  BacktestTrade,
  BacktestSettings,
  BtOutcome,
  BtSession,
} from "@/lib/backtest/types";
import { DEFAULT_BACKTEST_SETTINGS, BT_SESSIONS } from "@/lib/backtest/types";
import { resolvedPnl } from "@/lib/backtest/stats";
import { formatMoney, formatDate, currencySymbol } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { BacktestForm } from "./BacktestForm";
import { QuickLogModal } from "./QuickLogModal";
import { BacktestCalendar } from "./BacktestCalendar";
import { BacktestAnalytics } from "./BacktestAnalytics";
import { DayDetailModal } from "./DayDetailModal";

type Tab = "log" | "calendar" | "analytics";

const TABS: { id: Tab; label: string; icon: typeof History }[] = [
  { id: "log", label: "Registro", icon: History },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "analytics", label: "Análisis", icon: BarChart3 },
];

const OUTCOME_BADGE: Record<BtOutcome, { label: string; cls: string; icon: typeof Trophy }> = {
  win: { label: "WIN", cls: "bg-profit/15 text-profit", icon: Trophy },
  loss: { label: "LOSS", cls: "bg-loss/15 text-loss", icon: Target },
  be: { label: "BE", cls: "bg-muted/15 text-muted", icon: Minus },
};

function todayISODate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function BacktestApp() {
  const [tab, setTab] = useState<Tab>("log");
  const [workSession, setWorkSession] = useState<BtSession>("NY");
  const [workDate, setWorkDate] = useState<string>(() => todayISODate());
  const [workExpectedTP, setWorkExpectedTP] = useState<string>("3");
  const [trades, setTrades] = useState<BacktestTrade[] | undefined>(undefined);
  const [settings, setSettings] = useState<BacktestSettings>(
    DEFAULT_BACKTEST_SETTINGS
  );
  const [formKey, setFormKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BacktestTrade | undefined>(undefined);
  const [modalDate, setModalDate] = useState<string | undefined>(undefined);
  const [dayDetailKey, setDayDetailKey] = useState<string | null>(null);

  const reload = () => fetchBacktests().then(setTrades);

  useEffect(() => {
    fetchBacktestSettings().then(setSettings);
    reload();
  }, []);

  const openNew = () => {
    setEditing(undefined);
    setModalDate(undefined);
    setModalOpen(true);
  };
  const openForDay = (dateStr: string) => {
    setEditing(undefined);
    setModalDate(dateStr);
    setModalOpen(true);
  };
  const openEdit = (t: BacktestTrade) => {
    setEditing(t);
    setModalDate(undefined);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditing(undefined);
    setFormKey((k) => k + 1);
    reload();
  };

  const handleInlineSaved = () => {
    setFormKey((k) => k + 1);
    reload();
  };

  const handleDelete = async (t: BacktestTrade) => {
    if (!confirm("¿Eliminar esta operación de replay? Esto no se puede deshacer.")) return;
    await apiDelete(t.id);
    reload();
  };

  const updateRisk = async (value: number) => {
    setSettings((s) => ({ ...s, riskPerTrade: value }));
    const saved = await saveBacktestSettings({ riskPerTrade: value });
    setSettings(saved);
  };
  const updateCurrency = async (value: string) => {
    setSettings((s) => ({ ...s, currency: value }));
    const saved = await saveBacktestSettings({ currency: value });
    setSettings(saved);
  };

  const recent = useMemo(
    () =>
      [...(trades ?? [])].sort((a, b) => {
        const d = new Date(b.date).getTime() - new Date(a.date).getTime();
        return d !== 0 ? d : b.id - a.id;
      }),
    [trades]
  );

  const sessionCounts = useMemo(() => {
    const counts: Record<BtSession, number> = { NY: 0, Tokyo: 0 };
    for (const t of trades ?? []) counts[t.session]++;
    return counts;
  }, [trades]);

  const filteredRecent = useMemo(
    () => recent.filter((t) => t.session === workSession),
    [recent, workSession]
  );

  const money = (v: number) => formatMoney(v, settings.currency);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <History className="h-6 w-6 text-accent" />
            Replay de Backtest
          </h1>
          <p className="text-sm text-muted">
            Registro sin fricciones para sesiones de replay de NY y Tokio.
          </p>
        </div>
        <button onClick={openNew} className="btn btn-primary">
          <Zap className="h-4 w-4" /> Registro Rápido
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {trades === undefined ? (
        <div className="text-muted">Cargando…</div>
      ) : tab === "log" ? (
        <div className="space-y-6">
          {/* Fixed defaults: applied to every trade you log below */}
          <div className="card flex flex-wrap items-end gap-4 p-4">
            <div>
              <label className="field-label">Sesión de registro</label>
              <div className="grid grid-cols-2 gap-2">
                {BT_SESSIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setWorkSession(s)}
                    className={clsx(
                      "flex w-24 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                      workSession === s
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border text-muted hover:bg-surface-2"
                    )}
                  >
                    {s}
                    <span
                      className={clsx(
                        "rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                        workSession === s
                          ? "bg-accent/20 text-accent"
                          : "bg-surface-2 text-muted"
                      )}
                    >
                      {sessionCounts[s]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="field-label">Fecha</label>
              <input
                type="date"
                className="field-input w-44"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value || todayISODate())}
              />
            </div>

            <div>
              <label className="field-label">TP Esperado (R:R)</label>
              <input
                type="number"
                step="0.1"
                className="field-input w-28 tabular-nums"
                placeholder="3.0"
                value={workExpectedTP}
                onChange={(e) => setWorkExpectedTP(e.target.value)}
              />
            </div>

            <p className="ml-auto max-w-xs text-xs text-muted">
              Estos se mantienen fijos para cada operación que registras — configúralos una vez por
              sesión para no tener que volver a escribirlos.
            </p>
          </div>

          {/* Settings row */}
          <div className="card flex flex-wrap items-end gap-4 p-4">
            <div>
              <label className="field-label">Riesgo fijo / operación</label>
              <div className="flex items-center gap-2">
                <span className="text-muted">
                  {currencySymbol(settings.currency)}
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="field-input w-28 tabular-nums"
                  value={settings.riskPerTrade}
                  onChange={(e) => updateRisk(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div>
              <label className="field-label">Divisa</label>
              <select
                className="field-select w-28"
                value={settings.currency}
                onChange={(e) => updateCurrency(e.target.value)}
              >
                {["USD", "EUR", "GBP", "JPY"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <p className="ml-auto max-w-xs text-xs text-muted">
              El P/L neto se deriva automáticamente de tu R realizada × riesgo fijo cuando
              dejas el campo de dólares en blanco.
            </p>
          </div>

          {/* Inline quick-log form */}
          <div className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent">
                <Zap className="h-4 w-4" /> Nueva operación de replay de {workSession}
              </h2>
              <span className="text-xs text-muted">
                {workSession} · {workDate}
                {workExpectedTP.trim() ? ` · objetivo ${workExpectedTP}R` : ""}
              </span>
            </div>
            <BacktestForm
              key={`${formKey}-${workSession}-${workDate}-${workExpectedTP}`}
              settings={settings}
              defaultSession={workSession}
              defaultDate={workDate}
              defaultExpectedTP={workExpectedTP}
              hideDate
              hideSession
              hideExpectedTP
              onSaved={handleInlineSaved}
            />
          </div>

          {/* Recent entries */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Operaciones recientes de {workSession} ({filteredRecent.length})
            </h2>
            {filteredRecent.length === 0 ? (
              <EmptyState
                title={`Aún no hay operaciones de ${workSession}`}
                description="Registra tu primera operación simulada arriba — dirección, resultado y R:R es todo lo que se necesita."
              />
            ) : (
              <div className="space-y-2">
                {filteredRecent.map((t) => {
                  const badge = OUTCOME_BADGE[t.outcome];
                  const BadgeIcon = badge.icon;
                  const DirIcon =
                    t.direction === "long" ? TrendingUp : TrendingDown;
                  const pnl = resolvedPnl(t, settings.riskPerTrade);
                  return (
                    <div
                      key={t.id}
                      className="card flex items-center gap-3 p-3"
                    >
                      {t.screenshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.screenshot}
                          alt="gráfico"
                          className="hidden h-12 w-16 rounded-md border border-border object-cover sm:block"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
                              badge.cls
                            )}
                          >
                            <BadgeIcon className="h-3 w-3" />
                            {badge.label}
                          </span>
                          <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                            {t.session}
                          </span>
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1 text-xs font-semibold",
                              t.direction === "long"
                                ? "text-profit"
                                : "text-loss"
                            )}
                          >
                            <DirIcon className="h-3 w-3" />
                            {t.direction.toUpperCase()}
                          </span>
                          {t.asset && (
                            <span className="text-xs font-medium">
                              {t.asset}
                            </span>
                          )}
                          <span className="text-xs text-muted">
                            {formatDate(t.date)}
                          </span>
                          {t.contracts !== null && (
                            <span className="text-xs text-muted">
                              · {t.contracts}
                              {t.contracts === 1 ? " lote" : " lotes"}
                            </span>
                          )}
                          {t.plannedRR !== null && (
                            <span className="text-xs text-muted">
                              · objetivo {t.plannedRR.toFixed(1)}R
                            </span>
                          )}
                        </div>
                        {t.setups.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {t.setups.map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                        {t.notes && (
                          <p className="mt-1 truncate text-xs text-muted">
                            {t.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div
                          className={clsx(
                            "font-semibold tabular-nums",
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
                        <div
                          className={clsx(
                            "text-xs tabular-nums",
                            pnl > 0
                              ? "text-profit"
                              : pnl < 0
                                ? "text-loss"
                                : "text-muted"
                          )}
                        >
                          {money(pnl)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => openEdit(t)}
                          className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="rounded-md p-1.5 text-muted hover:bg-loss/10 hover:text-loss"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : tab === "calendar" ? (
        <div className="card p-5">
          <BacktestCalendar
            trades={trades}
            settings={settings}
            onDayClick={(k) => setDayDetailKey(k)}
          />
        </div>
      ) : (
        <BacktestAnalytics trades={trades} settings={settings} />
      )}

      <QuickLogModal
        open={modalOpen}
        trade={editing}
        settings={settings}
        defaultDate={modalDate ?? workDate}
        defaultSession={workSession}
        defaultExpectedTP={workExpectedTP}
        onSaved={handleSaved}
        onClose={() => {
          setModalOpen(false);
          setEditing(undefined);
        }}
      />

      <DayDetailModal
        dateKey={dayDetailKey}
        trades={trades ?? []}
        settings={settings}
        onClose={() => setDayDetailKey(null)}
        onQuickLog={(k) => {
          setDayDetailKey(null);
          openForDay(k);
        }}
        onEdit={(t) => {
          setDayDetailKey(null);
          openEdit(t);
        }}
      />
    </div>
  );
}
