export function formatMoney(value: number, currency = "USD"): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = currencySymbol(currency);
  return `${sign}${symbol}${formatted}`;
}

export function currencySymbol(currency: string): string {
  switch (currency) {
    case "USD":
      return "$";
    case "EUR":
      return "\u20ac";
    case "GBP":
      return "\u00a3";
    case "JPY":
      return "\u00a5";
    default:
      return "";
  }
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "\u2014";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "\u2014";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compact, X-style relative time: "now", "5m", "3h", "2d", then a date. */
export function formatRelativeTime(iso: string): string {
  if (!iso) return "\u2014";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "\u2014";
  const diffMs = Date.now() - then;
  const secs = Math.floor(diffMs / 1000);
  if (secs < 45) return "now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function formatDate(iso: string): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatRR(rr: number | null): string {
  if (rr === null || rr === undefined || Number.isNaN(rr) || !Number.isFinite(rr)) {
    return "\u2014";
  }
  return `1:${rr.toFixed(2)}`;
}

/**
 * Session for a trade: prefer the explicitly stored session and fall back to
 * deriving it from the hour for legacy trades logged before sessions were saved.
 */
export function tradeSession(trade: {
  session?: string;
  openedAt: string;
}): string {
  if (trade.session && trade.session.trim()) return trade.session.trim();
  return sessionFromDate(trade.openedAt);
}

/** Trading session from the hour of the trade (local time of the record). */
export function sessionFromDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const h = d.getHours();
  if (h >= 0 && h < 7) return "Asia";
  if (h >= 7 && h < 12) return "London";
  if (h >= 12 && h < 17) return "New York";
  if (h >= 17 && h < 21) return "NY PM";
  return "After Hours";
}

export function durationLabel(openIso: string, closeIso: string): string {
  const open = new Date(openIso).getTime();
  const close = new Date(closeIso).getTime();
  if (Number.isNaN(open) || Number.isNaN(close) || close < open) return "\u2014";
  const mins = Math.round((close - open) / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}
