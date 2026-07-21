"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { fetchTrade, fetchSettings, deleteTrade } from "@/lib/api";
import type { Trade } from "@/lib/types";
import {
  formatMoney,
  formatDate,
  formatPercent,
  formatRR,
  formatNumber,
  tradeSession,
} from "@/lib/format";
import { plannedRR, realizedRR, outcome } from "@/lib/stats";
import {
  PnL,
  DirectionBadge,
  OutcomeBadge,
  Chip,
  SectionTitle,
} from "@/components/ui";
import {
  TradeDocumentEditor,
  type PdfHeader,
} from "@/components/TradeDocumentEditor";

export default function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tradeId = Number(id);
  const router = useRouter();
  const [trade, setTrade] = useState<Trade | null | undefined>(undefined);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    fetchSettings().then((s) => setCurrency(s.currency));
    fetchTrade(tradeId).then(setTrade);
  }, [tradeId]);

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta operación? Esto no se puede deshacer.")) return;
    await deleteTrade(tradeId);
    router.push("/trades");
    router.refresh();
  };

  if (trade === undefined) return <div className="text-muted">Cargando…</div>;
  if (trade === null)
    return (
      <div className="space-y-4">
        <p className="text-muted">Operación no encontrada.</p>
        <Link href="/trades" className="btn btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Volver a operaciones
        </Link>
      </div>
    );

  const money = (v: number) => formatMoney(v, currency);
  const netAfterFees = trade.netPnl;

  const pdfHeader: PdfHeader = {
    title: `${trade.asset} · ${trade.direction.toUpperCase()}`,
    subtitle: `${formatDate(trade.closedAt)} · ${tradeSession(trade)} session`,
    stats: [
      { label: "Net PnL", value: money(netAfterFees) },
      { label: "Net %", value: formatPercent(trade.netPnlPercent) },
      { label: "Planned R:R", value: formatRR(plannedRR(trade)) },
      { label: "Realized R:R", value: formatRR(realizedRR(trade)) },
      { label: "Fees", value: money(trade.fees) },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn btn-ghost">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{trade.asset}</h1>
              <DirectionBadge direction={trade.direction} />
              <OutcomeBadge outcome={outcome(trade)} />
            </div>
            <p className="text-sm text-muted">
              {formatDate(trade.closedAt)} · {tradeSession(trade)} session
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/trades/${tradeId}/edit`} className="btn btn-ghost">
            <Pencil className="h-4 w-4" /> Editar
          </Link>
          <button onClick={handleDelete} className="btn btn-danger">
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
        </div>
      </div>

      {/* Headline PnL */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-muted">PnL Neto</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            <PnL value={netAfterFees} format={money} />
          </div>
          <div className="text-xs text-muted mt-0.5">
            {formatPercent(trade.netPnlPercent)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-muted">R:R Planificado</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatRR(plannedRR(trade))}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-muted">R:R Realizado</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatRR(realizedRR(trade))}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Comisiones</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-muted">
            {money(trade.fees)}
          </div>
        </div>
      </div>

      {/* Quantitative details */}
      <section className="card p-5">
        <SectionTitle>Cuantitativo</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-4 gap-x-6 text-sm">
          <Field label="Precio de Entrada" value={formatNumber(trade.entryPrice, 5)} />
          <Field label="Precio de Salida" value={formatNumber(trade.exitPrice, 5)} />
          <Field
            label="Riesgo Planificado ($)"
            value={trade.stopLoss === null ? "—" : money(trade.stopLoss)}
          />
          <Field
            label="Recompensa Planificada ($)"
            value={trade.takeProfit === null ? "—" : money(trade.takeProfit)}
          />
          <Field label="Tamaño de Posición" value={formatNumber(trade.positionSize, 2)} />
          <Field label="Tipo de Orden" value={<span className="capitalize">{trade.orderType}</span>} />
          <Field label="PnL Neto %" value={formatPercent(trade.netPnlPercent)} />
          <Field label="Comisiones / Swap" value={money(trade.fees)} />
        </div>
      </section>

      {/* Qualitative */}
      <section className="card p-5">
        <SectionTitle>Cualitativo — Contexto Técnico</SectionTitle>

        <div className="mb-4">
          <div className="field-label">Activador de Configuración / Estrategia</div>
          {trade.setups.length ? (
            <div className="flex flex-wrap gap-2">
              {trade.setups.map((s) => (
                <Chip key={s} tone="accent">
                  {s}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
        </div>

        <div className="mb-4">
          <div className="field-label">Gestión de Operación</div>
          <div className="flex flex-wrap gap-2">
            {trade.movedToBreakEven && <Chip>SL movido a BE</Chip>}
            {trade.tookPartials && <Chip>Tomó parciales</Chip>}
            {trade.closedManually && <Chip>Cerrado manualmente</Chip>}
            {!trade.movedToBreakEven &&
              !trade.tookPartials &&
              !trade.closedManually && (
                <span className="text-sm text-muted">No se registraron ajustes</span>
              )}
          </div>
          {trade.managementNotes && (
            <p className="mt-2 text-sm whitespace-pre-wrap">{trade.managementNotes}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScreenshotView label="Antes — Configuración" url={trade.screenshotBefore} />
          <ScreenshotView label="Después — Resultado" url={trade.screenshotAfter} />
        </div>
      </section>

      {/* Psychological */}
      <section className="card p-5">
        <SectionTitle>Registro Psicológico</SectionTitle>
        <div className="space-y-4">
          <TextBlock label="Mentalidad Pre-Operación" value={trade.preTradeMindset} />
          <TextBlock label="Comportamiento Durante la Operación" value={trade.inTradeBehavior} />
          <TextBlock label="Revisión Post-Operación / Lecciones" value={trade.postTradeReview} />
          <div>
            <div className="field-label">Veredicto de Disciplina</div>
            {trade.compliance === "compliant" ? (
              <Chip tone="accent">Plan seguido</Chip>
            ) : trade.compliance === "mistake" ? (
              <Chip tone="warning">Regla rota</Chip>
            ) : (
              <span className="text-sm text-muted">Sin etiquetar</span>
            )}
          </div>
        </div>
      </section>

      {/* Trade journal document */}
      <section className="card p-5">
        <SectionTitle desc="Escribe un desglose completo con formato e imágenes incrustadas, luego expórtalo como un PDF que permanece adjunto a esta operación.">
          Diario de Operaciones
        </SectionTitle>
        <TradeDocumentEditor tradeId={tradeId} pdfHeader={pdfHeader} />
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      {value ? (
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{value}</p>
      ) : (
        <p className="text-sm text-muted">—</p>
      )}
    </div>
  );
}

function ScreenshotView({
  label,
  url,
}: {
  label: string;
  url: string | null;
}) {
  return (
    <div>
      <div className="field-label">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="w-full rounded-lg border border-border object-contain bg-background max-h-96"
          />
        </a>
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-10 text-sm text-muted">
          No hay captura de pantalla
        </div>
      )}
    </div>
  );
}
