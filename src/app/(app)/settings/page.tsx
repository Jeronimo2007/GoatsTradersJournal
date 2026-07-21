"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Download,
  Upload,
  Trash2,
  Plus,
  Check,
  Pencil,
  X,
} from "lucide-react";
import {
  fetchBootstrap,
  saveSettings,
  clearTrades,
  importCsv,
} from "@/lib/api";
import { SectionTitle } from "@/components/ui";
import { useAccounts } from "@/components/AccountsProvider";
import clsx from "clsx";
import type { Account } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const [balance, setBalance] = useState("10000");
  const [currency, setCurrency] = useState("USD");
  const [count, setCount] = useState<number | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBootstrap().then(({ settings, trades }) => {
      if (cancelled) return;
      setBalance(String(settings.accountBalance));
      setCurrency(settings.currency);
      setCount(trades.length);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const flash = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(null), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings({ accountBalance: Number(balance) || 0, currency });
    flash("Configuración guardada.");
    router.refresh();
  };

  const handleExport = () => {
    // Streams the CSV from the API (generated from Supabase).
    window.location.href = "/api/export";
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const imported = await importCsv(text);
      const { trades } = await fetchBootstrap();
      setCount(trades.length);
      flash(`Se importaron ${imported} operaciones.`);
      router.refresh();
    } catch {
      flash("Error de importación — archivo CSV inválido.");
    }
  };

  const handleClear = async () => {
    if (
      !confirm(
        "¿Eliminar TODAS las operaciones de la cuenta activa permanentemente? Exporta una copia de seguridad primero. Esto no se puede deshacer."
      )
    )
      return;
    await clearTrades();
    setCount(0);
    flash("Todas las operaciones eliminadas.");
    router.refresh();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Configuración</h1>

      {savedMsg && (
        <div className="card border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          {savedMsg}
        </div>
      )}

      <AccountsManager />

      <form onSubmit={handleSave} className="card p-5">
        <SectionTitle desc="Balance y divisa de la cuenta activa. Usado para calcular automáticamente el % de PnL y establecer la línea base de la curva de capital.">
          Balance
        </SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Balance Inicial</label>
            <input
              type="number"
              step="any"
              className="field-input"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Divisa</label>
            <select
              className="field-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button type="submit" className="btn btn-primary">
            <Save className="h-4 w-4" /> Guardar
          </button>
        </div>
      </form>

      <div className="card p-5">
        <SectionTitle desc="Exportar/importar opera en la cuenta activa. Todos los datos se almacenan en Supabase (Postgres + Almacenamiento).">
          Datos ({count ?? "…"} operaciones)
        </SectionTitle>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport} className="btn btn-ghost">
            <Download className="h-4 w-4" /> Descargar CSV
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-ghost">
            <Upload className="h-4 w-4" /> Importar CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
          <button onClick={handleClear} className="btn btn-danger">
            <Trash2 className="h-4 w-4" /> Borrar todos los datos
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          CSV backups carry your trade data and reference screenshot filenames.
          Screenshots themselves live in Supabase Storage and are not embedded in
          the CSV.
        </p>
      </div>
    </div>
  );
}

function AccountsManager() {
  const { accounts, activeId, loading, switchTo, create, rename, remove } =
    useAccounts();
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [newName, setNewName] = useState("");

  const handleSwitch = async (id: string) => {
    if (id === activeId || busy) return;
    setBusy(true);
    await switchTo(id);
  };

  const handleCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    await create(newName.trim());
  };

  const handleRename = async (id: string) => {
    if (!draftName.trim()) {
      setEditingId(null);
      return;
    }
    await rename(id, draftName.trim());
    setEditingId(null);
  };

  const handleDelete = async (acc: Account) => {
    if (
      !confirm(
        `¿Eliminar "${acc.name}" y TODAS sus operaciones y capturas de pantalla permanentemente? (Las lecciones compartidas se mantienen.) Esto no se puede deshacer.`
      )
    )
      return;
    await remove(acc.id);
  };

  return (
    <div className="card p-5">
        <SectionTitle desc="Mantén las cuentas financiadas separadas y aisladas. Al cambiar, se modifican las operaciones y estadísticas que ves. Las lecciones se comparten entre todas las cuentas.">
          Cuentas
      </SectionTitle>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : (
          accounts.map((acc) => {
            const isActive = acc.id === activeId;
            return (
              <div
                key={acc.id}
                className={clsx(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                  isActive ? "border-accent/50 bg-accent/5" : "border-border"
                )}
              >
                {editingId === acc.id ? (
                  <>
                    <input
                      className="field-input flex-1"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(acc.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      onClick={() => handleRename(acc.id)}
                      className="btn btn-primary"
                    >
                      <Check className="h-4 w-4" /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="btn btn-ghost"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{acc.name}</span>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                            <Check className="h-3 w-3" /> Activa
                          </span>
                        )}
                      </div>
                    </div>
                    {!isActive && (
                      <button
                        onClick={() => handleSwitch(acc.id)}
                        disabled={busy}
                        className="btn btn-ghost"
                      >
                        Cambiar
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingId(acc.id);
                        setDraftName(acc.name);
                      }}
                      className="rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                      title="Renombrar"
                      aria-label="Renombrar cuenta"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc)}
                      disabled={accounts.length <= 1}
                      className="rounded-md p-2 text-muted transition-colors hover:bg-surface-2 hover:text-loss disabled:cursor-not-allowed disabled:opacity-30"
                      title={
                        accounts.length <= 1
                          ? "No puedes eliminar tu única cuenta"
                          : "Eliminar cuenta"
                      }
                      aria-label="Eliminar cuenta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="field-input flex-1"
          placeholder="Nombre de la nueva cuenta (ej. FTMO 100k)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || busy}
          className="btn btn-primary disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Añadir
        </button>
      </div>
    </div>
  );
}
