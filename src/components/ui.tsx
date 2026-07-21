"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import type { Direction } from "@/lib/types";
import type { Outcome } from "@/lib/stats";

export function PnL({
  value,
  format,
  className,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const color =
    value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-muted";
  return <span className={clsx(color, className)}>{format(value)}</span>;
}

export function DirectionBadge({ direction }: { direction: Direction }) {
  const long = direction === "long";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
        long
          ? "bg-profit/15 text-profit"
          : "bg-loss/15 text-loss"
      )}
    >
      {long ? "LONG" : "SHORT"}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const map: Record<Outcome, string> = {
    win: "bg-profit/15 text-profit",
    loss: "bg-loss/15 text-loss",
    breakeven: "bg-muted/15 text-muted",
  };
  const label = outcome === "breakeven" ? "BE" : outcome.toUpperCase();
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        map[outcome]
      )}
    >
      {label}
    </span>
  );
}

export function Chip({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "warning";
}) {
  const tones = {
    default: "bg-surface-2 text-muted border-border",
    accent: "bg-accent/15 text-accent border-transparent",
    warning: "bg-warning/15 text-warning border-transparent",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "profit" | "loss";
}) {
  const valueColor =
    tone === "profit"
      ? "text-profit"
      : tone === "loss"
        ? "text-loss"
        : "text-foreground";
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={clsx("mt-1.5 text-2xl font-semibold tabular-nums", valueColor)}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  desc,
}: {
  children: ReactNode;
  desc?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
        {children}
      </h2>
      {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 px-6 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
