"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ListOrdered,
  PlusCircle,
  Lightbulb,
  Settings,
  History,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import clsx from "clsx";
import { AccountSwitcher } from "./AccountSwitcher";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/", label: "Panel", icon: LayoutDashboard, exact: true },
  { href: "/trades", label: "Operaciones", icon: ListOrdered, exact: false },
  { href: "/trades/new", label: "Nueva Operación", icon: PlusCircle, exact: true },
  { href: "/lessons", label: "Lecciones", icon: Lightbulb, exact: false },
  { href: "/settings", label: "Configuración", icon: Settings, exact: true },
];

const replayNav = [
  { href: "/backtest", label: "Replay de Backtest", icon: History, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (href: string, exact: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 h-14">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image
            src="/image.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-md object-cover"
          />
          <span>Goats Traders Journal</span>
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-2 rounded-md hover:bg-surface-2"
          aria-label="Alternar menú"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={clsx(
          "fixed z-50 top-0 left-0 h-full w-60 border-r border-border bg-surface flex flex-col transition-transform duration-200",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center gap-2.5 px-4 border-b border-border">
          <Image
            src="/image.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-md object-cover"
          />
          <div className="leading-tight min-w-0">
            <div className="font-semibold text-[13px] truncate">
              Goats Traders Journal
            </div>
            <div className="text-[11px] text-muted">Rastrea. Revisa. Mejora.</div>
          </div>
        </div>

        <AccountSwitcher onNavigate={() => setOpen(false)} />

        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/15 text-foreground"
                    : "text-muted hover:text-foreground hover:bg-surface-2"
                )}
              >
                <Icon
                  className={clsx(active && "text-accent")}
                  style={{ width: 18, height: 18 }}
                />
                {item.label}
              </Link>
            );
          })}

          <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Laboratorio de Replay
          </div>
          {replayNav.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/15 text-foreground"
                    : "text-muted hover:text-foreground hover:bg-surface-2"
                )}
              >
                <Icon
                  className={clsx(active && "text-accent")}
                  style={{ width: 18, height: 18 }}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <LogOut style={{ width: 18, height: 18 }} />
            {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
          <p className="px-3 text-[11px] text-muted">
            Los datos son privados de tu cuenta en Supabase.
          </p>
        </div>
      </aside>
    </>
  );
}
