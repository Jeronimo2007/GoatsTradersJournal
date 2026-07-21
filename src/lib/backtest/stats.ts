import type { BacktestTrade, BtOutcome } from "./types";

/**
 * Resolve the $ P/L for a trade. When netPnl was left blank we derive it from
 * the realized R and the configured fixed risk-per-trade, so the module works
 * whether or not the user bothers typing dollar amounts.
 */
export function resolvedPnl(t: BacktestTrade, riskPerTrade: number): number {
  if (t.netPnl !== null && Number.isFinite(t.netPnl)) return t.netPnl;
  const risk =
    t.riskAmount !== null && Number.isFinite(t.riskAmount)
      ? t.riskAmount
      : riskPerTrade;
  return t.rr * risk;
}

/** Day key ("YYYY-MM-DD") in local time for a trade's date. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface BtStats {
  count: number;
  wins: number;
  losses: number;
  breakevens: number;
  /** Wins / (Wins + Losses) — breakevens excluded. */
  winRate: number;
  totalRR: number;
  avgRR: number;
  netPnl: number;
  bestRR: number;
  worstRR: number;
}

function classify(o: BtOutcome) {
  return { win: o === "win", loss: o === "loss", be: o === "be" };
}

export function computeStats(
  trades: BacktestTrade[],
  riskPerTrade: number
): BtStats {
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let totalRR = 0;
  let netPnl = 0;
  let bestRR = -Infinity;
  let worstRR = Infinity;

  for (const t of trades) {
    const c = classify(t.outcome);
    if (c.win) wins++;
    else if (c.loss) losses++;
    else breakevens++;
    totalRR += t.rr;
    netPnl += resolvedPnl(t, riskPerTrade);
    bestRR = Math.max(bestRR, t.rr);
    worstRR = Math.min(worstRR, t.rr);
  }

  const decided = wins + losses;
  const count = trades.length;
  return {
    count,
    wins,
    losses,
    breakevens,
    winRate: decided > 0 ? (wins / decided) * 100 : 0,
    totalRR,
    avgRR: count > 0 ? totalRR / count : 0,
    netPnl,
    bestRR: count ? bestRR : 0,
    worstRR: count ? worstRR : 0,
  };
}

export interface BtGroupStat extends BtStats {
  key: string;
}

export function groupBy(
  trades: BacktestTrade[],
  keyFn: (t: BacktestTrade) => string,
  riskPerTrade: number
): BtGroupStat[] {
  const map = new Map<string, BacktestTrade[]>();
  for (const t of trades) {
    const k = keyFn(t);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  const out: BtGroupStat[] = [];
  for (const [key, group] of map) {
    out.push({ key, ...computeStats(group, riskPerTrade) });
  }
  return out;
}

export function statsBySession(
  trades: BacktestTrade[],
  riskPerTrade: number
): BtGroupStat[] {
  return groupBy(trades, (t) => t.session, riskPerTrade).sort(
    (a, b) => b.totalRR - a.totalRR
  );
}

export function statsByDirection(
  trades: BacktestTrade[],
  riskPerTrade: number
): BtGroupStat[] {
  return groupBy(
    trades,
    (t) => (t.direction === "long" ? "Largo" : "Corto"),
    riskPerTrade
  ).sort((a, b) => b.totalRR - a.totalRR);
}

export function statsBySetup(
  trades: BacktestTrade[],
  riskPerTrade: number
): BtGroupStat[] {
  const map = new Map<string, BacktestTrade[]>();
  for (const t of trades) {
    const setups = t.setups.length ? t.setups : ["Sin etiqueta"];
    for (const s of setups) {
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(t);
    }
  }
  const out: BtGroupStat[] = [];
  for (const [key, group] of map) {
    out.push({ key, ...computeStats(group, riskPerTrade) });
  }
  return out.sort((a, b) => b.totalRR - a.totalRR);
}

export function statsByAsset(
  trades: BacktestTrade[],
  riskPerTrade: number
): BtGroupStat[] {
  return groupBy(
    trades,
    (t) => (t.asset.trim() ? t.asset.trim() : "Sin especificar"),
    riskPerTrade
  ).sort((a, b) => b.totalRR - a.totalRR);
}

// ---------- calendar aggregation ----------

export interface DayAgg {
  key: string; // YYYY-MM-DD
  count: number;
  wins: number;
  losses: number;
  breakevens: number;
  netRR: number;
  netPnl: number;
}

/** Aggregate trades per calendar day, keyed by YYYY-MM-DD. */
export function aggregateByDay(
  trades: BacktestTrade[],
  riskPerTrade: number
): Map<string, DayAgg> {
  const map = new Map<string, DayAgg>();
  for (const t of trades) {
    const key = dayKey(t.date);
    if (!key) continue;
    const agg =
      map.get(key) ??
      {
        key,
        count: 0,
        wins: 0,
        losses: 0,
        breakevens: 0,
        netRR: 0,
        netPnl: 0,
      };
    agg.count++;
    if (t.outcome === "win") agg.wins++;
    else if (t.outcome === "loss") agg.losses++;
    else agg.breakevens++;
    agg.netRR += t.rr;
    agg.netPnl += resolvedPnl(t, riskPerTrade);
    map.set(key, agg);
  }
  return map;
}

// ---------- equity progression (by R) ----------

export interface RrPoint {
  index: number;
  label: string;
  cumRR: number;
  rr: number;
}

/** Cumulative R curve in the order trades were logged (by id). */
export function rrCurve(trades: BacktestTrade[]): RrPoint[] {
  const sorted = [...trades].sort((a, b) => a.id - b.id);
  let cum = 0;
  const points: RrPoint[] = [{ index: 0, label: "Inicio", cumRR: 0, rr: 0 }];
  sorted.forEach((t, i) => {
    cum += t.rr;
    points.push({ index: i + 1, label: `#${i + 1}`, cumRR: cum, rr: t.rr });
  });
  return points;
}

// ---------- insights ("Aha!" section) ----------

export interface Insight {
  tone: "good" | "bad" | "info";
  text: string;
}

const MIN_SAMPLE = 4; // don't draw conclusions from tiny samples

function fmtWr(g: { winRate: number; wins: number; losses: number }): string {
  return `${g.winRate.toFixed(0)}% TG (${g.wins}G/${g.losses}P)`;
}

/**
 * Parse the recorded trades into plain-language, actionable suggestions.
 * Everything is guarded by a minimum sample size to avoid noise.
 */
export function buildInsights(
  trades: BacktestTrade[],
  riskPerTrade: number
): Insight[] {
  const insights: Insight[] = [];
  if (trades.length < MIN_SAMPLE) {
    insights.push({
      tone: "info",
      text: `Registra al menos ${MIN_SAMPLE} operaciones para desbloquear insights automáticos. Tienes ${trades.length}.`,
    });
    return insights;
  }

  // Session x Direction combos — the classic "skip this" finder.
  const combos = groupBy(
    trades,
    (t) =>
      `${t.direction === "long" ? "Largo" : "Corto"} en ${t.session === "Tokyo" ? "Tokio" : t.session}`,
    riskPerTrade
  );
  for (const c of combos) {
    const decided = c.wins + c.losses;
    if (decided < MIN_SAMPLE) continue;
    if (c.winRate <= 35) {
      insights.push({
        tone: "bad",
        text: `Tus operaciones de ${c.key} tienen solo ${fmtWr(c)} y ${c.totalRR >= 0 ? "+" : ""}${c.totalRR.toFixed(1)}R en total. Considera saltarte esta combinación.`,
      });
    } else if (c.winRate >= 65 && c.totalRR > 0) {
      insights.push({
        tone: "good",
        text: `${c.key} es una fortaleza — ${fmtWr(c)} y +${c.totalRR.toFixed(1)}R en total. Apóyate en ella.`,
      });
    }
  }

  // Best setup by average R.
  const setups = statsBySetup(trades, riskPerTrade).filter(
    (s) => s.count >= MIN_SAMPLE && s.key !== "Sin etiqueta"
  );
  if (setups.length) {
    const bestByRR = [...setups].sort((a, b) => b.avgRR - a.avgRR)[0];
    if (bestByRR.avgRR > 0) {
      insights.push({
        tone: "good",
        text: `Tu setup "${bestByRR.key}" tiene el R:R promedio más alto: ${bestByRR.avgRR.toFixed(2)}R en ${bestByRR.count} operaciones.`,
      });
    }
    const bestByWr = [...setups].sort((a, b) => b.winRate - a.winRate)[0];
    if (bestByWr.key !== bestByRR.key && bestByWr.winRate >= 60) {
      insights.push({
        tone: "good",
        text: `"${bestByWr.key}" es tu setup más fiable con ${bestByWr.winRate.toFixed(0)}% de tasa de ganancia.`,
      });
    }
    const worst = [...setups].sort((a, b) => a.totalRR - b.totalRR)[0];
    if (worst.totalRR < 0) {
      insights.push({
        tone: "bad",
        text: `"${worst.key}" está drenando R (${worst.totalRR.toFixed(1)}R en ${worst.count} operaciones). Refina los criterios o descártalo.`,
      });
    }
  }

  // Best vs worst session.
  const sessions = statsBySession(trades, riskPerTrade).filter(
    (s) => s.count >= MIN_SAMPLE
  );
  if (sessions.length === 2) {
    const [top, bottom] = [...sessions].sort((a, b) => b.avgRR - a.avgRR);
    if (top.avgRR - bottom.avgRR >= 0.5) {
      insights.push({
        tone: "info",
        text: `${top.key} supera a ${bottom.key}: ${top.avgRR.toFixed(2)}R vs ${bottom.avgRR.toFixed(2)}R por operación. Prioriza la sesión ${top.key}.`,
      });
    }
  }

  // Direction bias.
  const dirs = statsByDirection(trades, riskPerTrade).filter(
    (d) => d.count >= MIN_SAMPLE
  );
  if (dirs.length === 2) {
    const [top, bottom] = [...dirs].sort((a, b) => b.winRate - a.winRate);
    if (top.winRate - bottom.winRate >= 20) {
      insights.push({
        tone: "info",
        text: `Eres mucho más fuerte en ${top.key.toLowerCase()}s (${top.winRate.toFixed(0)}% TG) que en ${bottom.key.toLowerCase()}s (${bottom.winRate.toFixed(0)}% TG).`,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      tone: "info",
      text: "Aún no hay patrones claros — tu rendimiento está bastante equilibrado entre sesiones, direcciones y setups. Sigue registrando.",
    });
  }

  return insights;
}
