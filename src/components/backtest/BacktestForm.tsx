"use client";

import { useState } from "react";
import clsx from "clsx";
import { Save, Zap, TrendingUp, TrendingDown, Trophy, Target, Minus } from "lucide-react";
import { ScreenshotInput } from "@/components/ScreenshotInput";
import {
  createBacktest as apiCreate,
  updateBacktest as apiUpdate,
} from "@/lib/backtest/api";
import type {
  BacktestTrade,
  BacktestTradeInput,
  BacktestSettings,
  BtSession,
  BtDirection,
  BtOutcome,
} from "@/lib/backtest/types";
import {
  BT_SESSIONS,
  BT_SETUP_PRESETS,
  BT_ASSET_PRESETS,
  DEFAULT_RR_BY_OUTCOME,
} from "@/lib/backtest/types";
import { formatMoney } from "@/lib/format";

function isoToDateInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayInput(): string {
  return isoToDateInput(new Date().toISOString());
}

/** Date-only input -> ISO anchored at local noon so the day never shifts. */
function dateInputToIso(date: string): string {
  if (!date) return new Date().toISOString();
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

type FormState = {
  date: string;
  session: BtSession;
  direction: BtDirection;
  asset: string;
  setups: string[];
  outcome: BtOutcome;
  rr: string;
  plannedRR: string;
  riskAmount: string;
  contracts: string;
  netPnl: string;
  notes: string;
};

const numOrNull = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
};

/** Realized R that an outcome implies: win -> target TP, loss -> -1, BE -> 0. */
function rrForOutcome(o: BtOutcome, plannedRR: string): number {
  if (o === "loss") return -1;
  if (o === "be") return 0;
  return numOrNull(plannedRR) ?? DEFAULT_RR_BY_OUTCOME.win;
}

function initialState(
  trade: BacktestTrade | undefined,
  defaultDate: string | undefined,
  defaultSession: BtSession | undefined,
  defaultExpectedTP: string | undefined
): FormState {
  if (trade) {
    return {
      date: isoToDateInput(trade.date),
      session: trade.session,
      direction: trade.direction,
      asset: trade.asset,
      setups: trade.setups,
      outcome: trade.outcome,
      rr: String(trade.rr),
      plannedRR: trade.plannedRR === null ? "" : String(trade.plannedRR),
      riskAmount: trade.riskAmount === null ? "" : String(trade.riskAmount),
      contracts: trade.contracts === null ? "" : String(trade.contracts),
      netPnl: trade.netPnl === null ? "" : String(trade.netPnl),
      notes: trade.notes,
    };
  }
  const plannedRR = defaultExpectedTP ?? "";
  return {
    date: defaultDate || todayInput(),
    session: defaultSession ?? "NY",
    direction: "long",
    asset: "",
    setups: [],
    outcome: "win",
    rr: String(rrForOutcome("win", plannedRR)),
    plannedRR,
    riskAmount: "",
    contracts: "",
    netPnl: "",
    notes: "",
  };
}

const OUTCOME_META: Record<
  BtOutcome,
  { label: string; icon: typeof Trophy; active: string }
> = {
  win: {
    label: "Ganancia (TP)",
    icon: Trophy,
    active: "border-profit bg-profit/15 text-profit",
  },
  loss: {
    label: "Pérdida (SL)",
    icon: Target,
    active: "border-loss bg-loss/15 text-loss",
  },
  be: {
    label: "Punto de Equilibrio",
    icon: Minus,
    active: "border-muted bg-muted/15 text-foreground",
  },
};

export function BacktestForm({
  trade,
  settings,
  defaultDate,
  defaultSession,
  defaultExpectedTP,
  hideDate = false,
  hideSession = false,
  hideExpectedTP = false,
  onSaved,
  onCancel,
  compact = false,
}: {
  trade?: BacktestTrade;
  settings: BacktestSettings;
  defaultDate?: string;
  defaultSession?: BtSession;
  defaultExpectedTP?: string;
  hideDate?: boolean;
  hideSession?: boolean;
  hideExpectedTP?: boolean;
  onSaved: (trade: BacktestTrade) => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(trade, defaultDate, defaultSession, defaultExpectedTP)
  );
  const [screenshot, setScreenshot] = useState<string | null>(
    trade?.screenshot ?? null
  );
  const [customSetup, setCustomSetup] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectOutcome = (o: BtOutcome) =>
    setForm((f) => ({ ...f, outcome: o, rr: String(rrForOutcome(o, f.plannedRR)) }));

  const toggleSetup = (s: string) =>
    setForm((f) => ({
      ...f,
      setups: f.setups.includes(s)
        ? f.setups.filter((x) => x !== s)
        : [...f.setups, s],
    }));

  const addCustomSetup = () => {
    const s = customSetup.trim();
    if (s && !form.setups.includes(s)) {
      setForm((f) => ({ ...f, setups: [...f.setups, s] }));
    }
    setCustomSetup("");
  };

  const effectiveRisk = numOrNull(form.riskAmount) ?? settings.riskPerTrade;
  const typedPnl = numOrNull(form.netPnl);
  // When a $ P/L is entered (and we know the risk), R:R + outcome are derived
  // automatically from P/L ÷ risk. Otherwise the user drives R:R manually.
  const autoMode = typedPnl !== null && effectiveRisk > 0;
  const computedRR = autoMode
    ? Math.round((typedPnl! / effectiveRisk) * 100) / 100
    : numOrNull(form.rr) ?? 0;
  const effectiveOutcome: BtOutcome = autoMode
    ? typedPnl! > 0
      ? "win"
      : typedPnl! < 0
        ? "loss"
        : "be"
    : form.outcome;
  const derivedPnl = autoMode ? typedPnl! : computedRR * effectiveRisk;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!autoMode && numOrNull(form.rr) === null) {
      setError("Enter the realized R:R (e.g. -1, 0, 2.5) or a Net P/L.");
      return;
    }
    setSaving(true);
    const record: BacktestTradeInput = {
      date: dateInputToIso(form.date),
      session: form.session,
      direction: form.direction,
      asset: form.asset.trim().toUpperCase(),
      setups: form.setups,
      outcome: effectiveOutcome,
      rr: computedRR,
      plannedRR: numOrNull(form.plannedRR),
      riskAmount: numOrNull(form.riskAmount),
      contracts: numOrNull(form.contracts),
      netPnl: numOrNull(form.netPnl),
      screenshot,
      notes: form.notes,
    };
    try {
      const saved = trade
        ? await apiUpdate(trade.id, record)
        : await apiCreate(record);
      onSaved(saved);
    } catch (err) {
      console.error(err);
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  const money = (v: number) => formatMoney(v, settings.currency);

  const customSetups = form.setups.filter(
    (s) => !BT_SETUP_PRESETS.includes(s)
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="card border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
          {error}
        </div>
      )}

      <div
        className={clsx(
          "grid gap-4",
          compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3"
        )}
      >
        {/* Date */}
        {!hideDate && (
          <div>
            <label className="field-label">Date</label>
            <input
              type="date"
              className="field-input"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
        )}

        {/* Session */}
        {!hideSession && (
          <div>
            <label className="field-label">Session</label>
            <div className="grid grid-cols-2 gap-2">
              {BT_SESSIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("session", s)}
                  className={clsx(
                    "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                    form.session === s
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-muted hover:bg-surface-2"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Direction */}
        <div>
          <label className="field-label">Direction</label>
          <div className="grid grid-cols-2 gap-2">
            {(["long", "short"] as BtDirection[]).map((d) => {
              const Icon = d === "long" ? TrendingUp : TrendingDown;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => set("direction", d)}
                  className={clsx(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition-colors",
                    form.direction === d
                      ? d === "long"
                        ? "border-profit bg-profit/15 text-profit"
                        : "border-loss bg-loss/15 text-loss"
                      : "border-border text-muted hover:bg-surface-2"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Outcome */}
      <div>
        <label className="field-label">
          Outcome
          {autoMode && (
            <span className="ml-1 normal-case text-muted">
              — auto from P/L
            </span>
          )}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(OUTCOME_META) as BtOutcome[]).map((o) => {
            const meta = OUTCOME_META[o];
            const Icon = meta.icon;
            return (
              <button
                key={o}
                type="button"
                disabled={autoMode}
                onClick={() => selectOutcome(o)}
                className={clsx(
                  "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
                  effectiveOutcome === o
                    ? meta.active
                    : "border-border text-muted hover:bg-surface-2",
                  autoMode && effectiveOutcome !== o && "opacity-40",
                  autoMode && "cursor-not-allowed"
                )}
              >
                <Icon className="h-4 w-4" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* R:R + Net $ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label">
            Realized R:R
            {autoMode && (
              <span className="ml-1 normal-case text-muted">— auto</span>
            )}
          </label>
          <input
            type="number"
            step="0.1"
            className={clsx(
              "field-input tabular-nums",
              autoMode && "cursor-not-allowed opacity-60"
            )}
            placeholder="2.5"
            value={autoMode ? String(computedRR) : form.rr}
            disabled={autoMode}
            onChange={(e) => set("rr", e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">
            Net P/L ($){" "}
            <span className="normal-case text-muted">— sets R:R</span>
          </label>
          <input
            type="number"
            step="any"
            className="field-input tabular-nums"
            placeholder={money(computedRR * effectiveRisk)}
            value={form.netPnl}
            onChange={(e) => set("netPnl", e.target.value)}
          />
        </div>
      </div>

      {/* Optional trade details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {!hideExpectedTP && (
          <div>
            <label className="field-label">
              Expected TP{" "}
              <span className="normal-case text-muted">— target R:R</span>
            </label>
            <input
              type="number"
              step="0.1"
              className="field-input tabular-nums"
              placeholder="3.0"
              value={form.plannedRR}
              onChange={(e) => set("plannedRR", e.target.value)}
            />
          </div>
        )}
        <div>
          <label className="field-label">
            Risk Used ($){" "}
            <span className="normal-case text-muted">— optional</span>
          </label>
          <input
            type="number"
            step="any"
            className="field-input tabular-nums"
            placeholder={String(settings.riskPerTrade)}
            value={form.riskAmount}
            onChange={(e) => set("riskAmount", e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">
            Contracts / Lots{" "}
            <span className="normal-case text-muted">— optional</span>
          </label>
          <input
            type="number"
            step="any"
            className="field-input tabular-nums"
            placeholder="1"
            value={form.contracts}
            onChange={(e) => set("contracts", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <span className="text-muted">
            {autoMode ? "R:R " : "Net P/L "}
          </span>
          {autoMode ? (
            <span
              className={clsx(
                "font-semibold tabular-nums",
                computedRR > 0
                  ? "text-profit"
                  : computedRR < 0
                    ? "text-loss"
                    : "text-muted"
              )}
            >
              {computedRR >= 0 ? "+" : ""}
              {computedRR.toFixed(2)}R
            </span>
          ) : (
            <span
              className={clsx(
                "font-semibold tabular-nums",
                derivedPnl > 0
                  ? "text-profit"
                  : derivedPnl < 0
                    ? "text-loss"
                    : "text-muted"
              )}
            >
              {money(derivedPnl)}
            </span>
          )}
          <span className="ml-1 text-xs text-muted">
            {autoMode
              ? `(from ${money(typedPnl!)} ÷ ${money(effectiveRisk)} risk)`
              : `(from ${effectiveRisk}$ risk × R)`}
          </span>
        </div>
      </div>

      {/* Setups */}
      <div>
        <label className="field-label">Setup / Strategy</label>
        <div className="flex flex-wrap gap-2">
          {BT_SETUP_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSetup(s)}
              className={clsx(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                form.setups.includes(s)
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted hover:bg-surface-2"
              )}
            >
              {s}
            </button>
          ))}
          {customSetups.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSetup(s)}
              className="rounded-full border border-accent bg-accent/15 px-3 py-1 text-xs font-medium text-accent"
            >
              {s} ✕
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="field-input"
            placeholder="Add custom setup…"
            value={customSetup}
            onChange={(e) => setCustomSetup(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomSetup();
              }
            }}
          />
          <button type="button" className="btn btn-ghost" onClick={addCustomSetup}>
            Add
          </button>
        </div>
      </div>

      {/* Asset (optional quick tag) */}
      <div>
        <label className="field-label">
          Asset <span className="normal-case text-muted">— optional</span>
        </label>
        <input
          list="bt-asset-presets"
          className="field-input uppercase"
          placeholder="XAUUSD"
          value={form.asset}
          onChange={(e) => set("asset", e.target.value)}
        />
        <datalist id="bt-asset-presets">
          {BT_ASSET_PRESETS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>

      {/* Screenshot + Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScreenshotInput
          label="Screenshot"
          value={screenshot}
          onChange={setScreenshot}
        />
        <div>
          <label className="field-label">Notes / Mistakes</label>
          <textarea
            className="field-textarea min-h-[9.5rem]"
            placeholder="Mistakes made, general thoughts, what to do differently…"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {trade ? <Save className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
          {saving ? "Saving…" : trade ? "Save Changes" : "Log Trade"}
        </button>
      </div>
    </form>
  );
}
