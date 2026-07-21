"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft } from "lucide-react";
import {
  fetchTrade,
  fetchSettings,
  createTrade,
  updateTrade,
  fetchTradeDocument,
  saveTradeDocument,
} from "@/lib/api";
import type { Trade, TradeInput, Direction, OrderType, Compliance } from "@/lib/types";
import { SETUP_PRESETS, ASSET_PRESETS, SESSION_PRESETS } from "@/lib/types";
import { plannedRR, realizedRR } from "@/lib/stats";
import { formatRR, tradeSession } from "@/lib/format";
import { SectionTitle } from "@/components/ui";
import { ScreenshotInput } from "@/components/ScreenshotInput";
import { TradeDocumentEditor } from "@/components/TradeDocumentEditor";
import clsx from "clsx";

type FormState = {
  date: string;
  session: string;
  asset: string;
  direction: Direction;
  entryPrice: string;
  exitPrice: string;
  stopLoss: string;
  takeProfit: string;
  positionSize: string;
  netPnl: string;
  netPnlPercent: string;
  fees: string;
  setups: string[];
  orderType: OrderType;
  movedToBreakEven: boolean;
  tookPartials: boolean;
  closedManually: boolean;
  managementNotes: string;
  preTradeMindset: string;
  inTradeBehavior: string;
  postTradeReview: string;
  compliance: Compliance | "";
};

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

/** A date-only input ("YYYY-MM-DD") -> ISO datetime, anchored at local noon so
 * the calendar day never shifts when formatted back for display. */
function dateInputToIso(date: string): string {
  if (!date) return new Date().toISOString();
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

const emptyState = (): FormState => ({
  date: todayInput(),
  session: SESSION_PRESETS[0],
  asset: "",
  direction: "long",
  entryPrice: "",
  exitPrice: "",
  stopLoss: "",
  takeProfit: "",
  positionSize: "",
  netPnl: "",
  netPnlPercent: "",
  fees: "",
  setups: [],
  orderType: "market",
  movedToBreakEven: false,
  tookPartials: false,
  closedManually: false,
  managementNotes: "",
  preTradeMindset: "",
  inTradeBehavior: "",
  postTradeReview: "",
  compliance: "",
});

const num = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
};

export function TradeForm({ tradeId }: { tradeId?: number }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyState);
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!tradeId);
  const [saving, setSaving] = useState(false);
  const [accountBalance, setAccountBalance] = useState(10000);
  const [customSetup, setCustomSetup] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [docHtml, setDocHtml] = useState("");
  const [docLoaded, setDocLoaded] = useState(!tradeId);

  useEffect(() => {
    fetchSettings().then((s) => setAccountBalance(s.accountBalance));
  }, []);

  useEffect(() => {
    if (!tradeId) return;
    let cancelled = false;
    fetchTradeDocument(tradeId)
      .then((doc) => {
        if (cancelled) return;
        setDocHtml(doc.html || "");
      })
      .finally(() => {
        if (!cancelled) setDocLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tradeId]);

  useEffect(() => {
    if (!tradeId) return;
    let cancelled = false;
    fetchTrade(tradeId).then((t) => {
      if (!t || cancelled) return;
      setForm({
        date: isoToDateInput(t.closedAt || t.openedAt),
        session: tradeSession(t),
        asset: t.asset,
        direction: t.direction,
        entryPrice: String(t.entryPrice ?? ""),
        exitPrice: String(t.exitPrice ?? ""),
        stopLoss: t.stopLoss === null ? "" : String(t.stopLoss),
        takeProfit: t.takeProfit === null ? "" : String(t.takeProfit),
        positionSize: String(t.positionSize ?? ""),
        netPnl: String(t.netPnl ?? ""),
        netPnlPercent: t.netPnlPercent === null ? "" : String(t.netPnlPercent),
        fees: String(t.fees ?? ""),
        setups: t.setups ?? [],
        orderType: t.orderType,
        movedToBreakEven: t.movedToBreakEven,
        tookPartials: t.tookPartials,
        closedManually: t.closedManually,
        managementNotes: t.managementNotes ?? "",
        preTradeMindset: t.preTradeMindset ?? "",
        inTradeBehavior: t.inTradeBehavior ?? "",
        postTradeReview: t.postTradeReview ?? "",
        compliance: t.compliance ?? "",
      });
      setBefore(t.screenshotBefore);
      setAfter(t.screenshotAfter);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tradeId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const previewTrade = useMemo<Trade>(
    () => ({
      id: 0,
      screenshotBefore: null,
      screenshotAfter: null,
      openedAt: dateInputToIso(form.date),
      closedAt: dateInputToIso(form.date),
      session: form.session,
      asset: form.asset,
      direction: form.direction,
      entryPrice: num(form.entryPrice) ?? 0,
      exitPrice: num(form.exitPrice) ?? 0,
      stopLoss: num(form.stopLoss),
      takeProfit: num(form.takeProfit),
      positionSize: num(form.positionSize) ?? 0,
      netPnl: num(form.netPnl) ?? 0,
      netPnlPercent: num(form.netPnlPercent),
      fees: num(form.fees) ?? 0,
      setups: form.setups,
      orderType: form.orderType,
      movedToBreakEven: form.movedToBreakEven,
      tookPartials: form.tookPartials,
      closedManually: form.closedManually,
      managementNotes: form.managementNotes,
      preTradeMindset: form.preTradeMindset,
      inTradeBehavior: form.inTradeBehavior,
      postTradeReview: form.postTradeReview,
      compliance: form.compliance || null,
      createdAt: "",
      updatedAt: "",
    }),
    [form]
  );

  const pRR = plannedRR(previewTrade);
  const rRR = realizedRR(previewTrade);

  const autoPercent = useMemo(() => {
    const pnl = num(form.netPnl);
    if (pnl === null || !accountBalance) return null;
    return (pnl / accountBalance) * 100;
  }, [form.netPnl, accountBalance]);

  const toggleSetup = (s: string) => {
    setForm((f) => ({
      ...f,
      setups: f.setups.includes(s)
        ? f.setups.filter((x) => x !== s)
        : [...f.setups, s],
    }));
  };

  const addCustomSetup = () => {
    const s = customSetup.trim();
    if (s && !form.setups.includes(s)) {
      setForm((f) => ({ ...f, setups: [...f.setups, s] }));
    }
    setCustomSetup("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.asset.trim()) {
      setError("El activo / ticker es requerido.");
      return;
    }
    if (num(form.entryPrice) === null || num(form.exitPrice) === null) {
      setError("Los precios de entrada y salida son requeridos.");
      return;
    }
    setSaving(true);
    const percent =
      num(form.netPnlPercent) ?? (autoPercent !== null ? autoPercent : null);

    const dayIso = dateInputToIso(form.date);
    const record: TradeInput = {
      openedAt: dayIso,
      closedAt: dayIso,
      session: form.session,
      asset: form.asset.trim().toUpperCase(),
      direction: form.direction,
      entryPrice: num(form.entryPrice) ?? 0,
      exitPrice: num(form.exitPrice) ?? 0,
      stopLoss: num(form.stopLoss),
      takeProfit: num(form.takeProfit),
      positionSize: num(form.positionSize) ?? 0,
      netPnl: num(form.netPnl) ?? 0,
      netPnlPercent: percent,
      fees: num(form.fees) ?? 0,
      setups: form.setups,
      orderType: form.orderType,
      screenshotBefore: before,
      screenshotAfter: after,
      movedToBreakEven: form.movedToBreakEven,
      tookPartials: form.tookPartials,
      closedManually: form.closedManually,
      managementNotes: form.managementNotes,
      preTradeMindset: form.preTradeMindset,
      inTradeBehavior: form.inTradeBehavior,
      postTradeReview: form.postTradeReview,
      compliance: form.compliance || null,
    };

    try {
      let savedId: number;
      if (tradeId) {
        await updateTrade(tradeId, record);
        savedId = tradeId;
      } else {
        const created = await createTrade(record);
        savedId = created.id;
      }
      // Persist the journal document. On create, only write when there's
      // content; on edit, always sync so clearing it is respected.
      if (docHtml.trim() !== "" || tradeId) {
        await saveTradeDocument(savedId, docHtml);
      }
      router.push(`/trades/${savedId}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Error al guardar la operación. Por favor, inténtalo de nuevo.");
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-muted">Cargando operación…</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-ghost"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <h1 className="text-xl font-semibold">
            {tradeId ? "Editar Operación" : "Nueva Operación"}
          </h1>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Guardar Operación"}
        </button>
      </div>

      {error && (
        <div className="card border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
          {error}
        </div>
      )}

      {/* SECTION 1 — Quantitative */}
      <section className="card p-5">
        <SectionTitle desc="Los números fríos y duros detrás de la operación.">
          1 · Datos Cuantitativos
        </SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="field-label">Fecha</label>
            <input
              type="date"
              className="field-input"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Sesión</label>
            <div className="grid grid-cols-2 gap-2">
              {SESSION_PRESETS.map((s) => (
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
          <div>
            <label className="field-label">Activo / Ticker</label>
            <input
              list="asset-presets"
              className="field-input uppercase"
              placeholder="XAUUSD"
              value={form.asset}
              onChange={(e) => set("asset", e.target.value)}
            />
            <datalist id="asset-presets">
              {ASSET_PRESETS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="field-label">Dirección</label>
            <div className="grid grid-cols-2 gap-2">
              {(["long", "short"] as Direction[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set("direction", d)}
                  className={clsx(
                    "rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition-colors",
                    form.direction === d
                      ? d === "long"
                        ? "border-profit bg-profit/15 text-profit"
                        : "border-loss bg-loss/15 text-loss"
                      : "border-border text-muted hover:bg-surface-2"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="field-label">Precio de Entrada</label>
            <input
              type="number"
              step="any"
              className="field-input"
              value={form.entryPrice}
              onChange={(e) => set("entryPrice", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Precio de Salida</label>
            <input
              type="number"
              step="any"
              className="field-input"
              value={form.exitPrice}
              onChange={(e) => set("exitPrice", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Riesgo Planificado en SL ($)</label>
            <input
              type="number"
              step="any"
              className="field-input"
              placeholder="250"
              value={form.stopLoss}
              onChange={(e) => set("stopLoss", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Recompensa Planificada en TP ($)</label>
            <input
              type="number"
              step="any"
              className="field-input"
              placeholder="1000"
              value={form.takeProfit}
              onChange={(e) => set("takeProfit", e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Tamaño de Posición (lotes)</label>
            <input
              type="number"
              step="any"
              className="field-input"
              placeholder="0.50"
              value={form.positionSize}
              onChange={(e) => set("positionSize", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">PnL Neto ($)</label>
            <input
              type="number"
              step="any"
              className="field-input"
              value={form.netPnl}
              onChange={(e) => set("netPnl", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">PnL Neto (%)</label>
            <input
              type="number"
              step="any"
              className="field-input"
              placeholder={autoPercent !== null ? autoPercent.toFixed(2) : "auto"}
              value={form.netPnlPercent}
              onChange={(e) => set("netPnlPercent", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Comisiones / Honorarios / Swap</label>
            <input
              type="number"
              step="any"
              className="field-input"
              value={form.fees}
              onChange={(e) => set("fees", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <span className="text-muted">R:R Planificado </span>
            <span className="font-semibold">{formatRR(pRR)}</span>
          </div>
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <span className="text-muted">R:R Realizado </span>
            <span className="font-semibold">{formatRR(rRR)}</span>
          </div>
          {autoPercent !== null && form.netPnlPercent.trim() === "" && (
            <div className="rounded-lg bg-surface-2 px-3 py-2">
              <span className="text-muted">% automático del balance </span>
              <span className="font-semibold">{autoPercent.toFixed(2)}%</span>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 2 — Qualitative */}
      <section className="card p-5">
        <SectionTitle desc="El contexto técnico — el porqué detrás de la operación.">
          2 · Datos Cualitativos
        </SectionTitle>

        <div className="space-y-4">
          <div>
            <label className="field-label">Activador de Configuración / Estrategia</label>
            <div className="flex flex-wrap gap-2">
              {SETUP_PRESETS.map((s) => (
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
              {form.setups
                .filter((s) => !SETUP_PRESETS.includes(s))
                .map((s) => (
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
                placeholder="Añadir activador personalizado…"
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
                Añadir
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Tipo de Orden</label>
              <select
                className="field-select"
                value={form.orderType}
                onChange={(e) => set("orderType", e.target.value as OrderType)}
              >
                <option value="market">Mercado</option>
                <option value="limit">Límite (pendiente)</option>
                <option value="stop">Stop (pendiente)</option>
              </select>
            </div>
            <div>
              <label className="field-label">Gestión de Operación</label>
              <div className="flex flex-wrap gap-4 pt-2">
                {[
                  ["movedToBreakEven", "SL movido a BE"],
                  ["tookPartials", "Tomó parciales"],
                  ["closedManually", "Cerrado manualmente"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={form[key as keyof FormState] as boolean}
                      onChange={(e) =>
                        set(key as keyof FormState, e.target.checked as never)
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="field-label">Notas de Gestión</label>
            <textarea
              className="field-textarea"
              placeholder="¿Cómo gestionaste la posición? Parcial en 1R, stop dinámico, etc."
              value={form.managementNotes}
              onChange={(e) => set("managementNotes", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ScreenshotInput
              label="Captura de pantalla — Antes (configuración)"
              value={before}
              onChange={setBefore}
            />
            <ScreenshotInput
              label="Captura de pantalla — Después (resultado)"
              value={after}
              onChange={setAfter}
            />
          </div>
        </div>
      </section>

      {/* SECTION 3 — Psychological */}
      <section className="card p-5">
        <SectionTitle desc="El juego mental — diagnostica errores de comportamiento.">
          3 · Registro Psicológico
        </SectionTitle>

        <div className="space-y-4">
          <div>
            <label className="field-label">Mentalidad Pre-Operación</label>
            <textarea
              className="field-textarea"
              placeholder="¿Paciente y siguiendo el plan? ¿O FOMO después de una expansión repentina?"
              value={form.preTradeMindset}
              onChange={(e) => set("preTradeMindset", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Comportamiento Durante la Operación</label>
            <textarea
              className="field-textarea"
              placeholder="¿Monitoreaste demasiado el gráfico? ¿Ampliaste el stop / rompiste las reglas?"
              value={form.inTradeBehavior}
              onChange={(e) => set("inTradeBehavior", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Revisión Post-Operación / Lecciones</label>
            <textarea
              className="field-textarea"
              placeholder="Cumplió con el plan; pérdida válida. O: Operación de venganza sin un activador válido."
              value={form.postTradeReview}
              onChange={(e) => set("postTradeReview", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Veredicto de Disciplina</label>
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              {(
                [
                  ["compliant", "Plan seguido"],
                  ["mistake", "Regla rota"],
                ] as [Compliance, string][]
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() =>
                    set("compliance", form.compliance === val ? "" : val)
                  }
                  className={clsx(
                    "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                    form.compliance === val
                      ? val === "compliant"
                        ? "border-profit bg-profit/15 text-profit"
                        : "border-warning bg-warning/15 text-warning"
                      : "border-border text-muted hover:bg-surface-2"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — Trade journal document */}
      <section className="card p-5">
        <SectionTitle desc="Redacción de formato libre con formato e imágenes en línea. Guardado con la operación; exportar a PDF desde la página de operaciones.">
          4 · Diario de Operaciones
        </SectionTitle>
        {docLoaded ? (
          <TradeDocumentEditor initialHtml={docHtml} onChange={setDocHtml} />
        ) : (
          <div className="py-10 text-center text-sm text-muted">
            Cargando diario…
          </div>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-ghost"
        >
          Cancelarar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Guardar Operación"}
        </button>
      </div>
    </form>
  );
}
