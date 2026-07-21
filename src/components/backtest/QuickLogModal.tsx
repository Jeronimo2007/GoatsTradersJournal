"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { BacktestForm } from "./BacktestForm";
import type {
  BacktestTrade,
  BacktestSettings,
  BtSession,
} from "@/lib/backtest/types";

export function QuickLogModal({
  open,
  trade,
  settings,
  defaultDate,
  defaultSession,
  defaultExpectedTP,
  onSaved,
  onClose,
}: {
  open: boolean;
  trade?: BacktestTrade;
  settings: BacktestSettings;
  defaultDate?: string;
  defaultSession?: BtSession;
  defaultExpectedTP?: string;
  onSaved: (trade: BacktestTrade) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="card relative z-10 my-4 w-full max-w-2xl p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {trade ? "Editar Operación de Replay" : "Registro Rápido"}
            </h2>
            <p className="text-xs text-muted">
              {trade
                ? "Actualizar este registro de backtest."
                : "Registra una operación de replay simulada en ~30 segundos."}
            </p>
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
        <BacktestForm
          trade={trade}
          settings={settings}
          defaultDate={defaultDate}
          defaultSession={defaultSession}
          defaultExpectedTP={defaultExpectedTP}
          onSaved={onSaved}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
