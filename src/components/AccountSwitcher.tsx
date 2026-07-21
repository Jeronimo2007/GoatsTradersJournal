"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, Check, Plus, Settings2, Wallet } from "lucide-react";
import clsx from "clsx";
import { useAccounts } from "./AccountsProvider";

export function AccountSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { accounts, activeId, switchTo, create } = useAccounts();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const active = accounts.find((a) => a.id === activeId);

  const handleSwitch = async (id: string) => {
    if (id === activeId || busy) return;
    setBusy(true);
    await switchTo(id);
  };

  const handleCreate = async () => {
    const name = window.prompt("Nombre para la nueva cuenta");
    if (name === null) return;
    setBusy(true);
    await create(name.trim());
  };

  return (
    <div ref={ref} className="relative px-3 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-left transition-colors hover:bg-[#1e2530]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
          <Wallet className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {active?.name ?? "Cargando…"}
          </div>
          <div className="text-[11px] text-muted">
            {accounts.length} cuenta{accounts.length === 1 ? "" : "s"}
          </div>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute left-3 right-3 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          <div className="max-h-64 overflow-y-auto py-1">
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => handleSwitch(a.id)}
                disabled={busy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                <Check
                  className={clsx(
                    "h-4 w-4 shrink-0",
                    a.id === activeId ? "text-accent" : "opacity-0"
                  )}
                />
                <span className="truncate">{a.name}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-border py-1">
            <button
              onClick={handleCreate}
              disabled={busy}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Añadir cuenta
            </button>
            <Link
              href="/settings"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" /> Administrar cuentas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
