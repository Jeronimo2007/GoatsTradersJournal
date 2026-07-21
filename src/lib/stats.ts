import type { Trade } from "./types";
import { tradeSession } from "./format";

/**
 * Planned reward:risk. Stop loss and take profit are the planned loss/profit
 * in account currency ($), so R:R is simply reward$ / risk$.
 */
export function plannedRR(trade: Trade): number | null {
  if (trade.stopLoss === null || trade.takeProfit === null) return null;
  const risk = Math.abs(trade.stopLoss);
  const reward = Math.abs(trade.takeProfit);
  if (risk === 0) return null;
  return reward / risk;
}

/**
 * Realized reward:risk: how many R the trade actually returned, i.e. the
 * net P/L divided by the planned risk in $ (a full stop-out is -1R).
 */
export function realizedRR(trade: Trade): number | null {
  if (trade.stopLoss === null) return null;
  const risk = Math.abs(trade.stopLoss);
  if (risk === 0) return null;
  return trade.netPnl / risk;
}

/**
 * Chronological order for the equity progression. Trades now store only a day
 * (no hour), so we order by their id — a monotonically increasing integer
 * assigned at creation — which reflects the exact order they were logged.
 */
function byCreation(a: Trade, b: Trade): number {
  return a.id - b.id;
}

export type Outcome = "win" | "loss" | "breakeven";

export function outcome(trade: Trade): Outcome {
  if (trade.netPnl > 0) return "win";
  if (trade.netPnl < 0) return "loss";
  return "breakeven";
}

export interface Stats {
  count: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number; // %
  netPnl: number;
  grossProfit: number;
  grossLoss: number; // positive number
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number; // positive number
  expectancy: number; // per trade
  avgRR: number | null; // realized
  bestTrade: number;
  worstTrade: number;
  totalFees: number;
  maxDrawdown: number; // in currency, positive
  currentStreak: { type: Outcome | null; length: number };
}

export function computeStats(trades: Trade[]): Stats {
  const count = trades.length;
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let netPnl = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalFees = 0;
  let best = -Infinity;
  let worst = Infinity;
  const rrs: number[] = [];

  for (const t of trades) {
    netPnl += t.netPnl;
    totalFees += t.fees || 0;
    const o = outcome(t);
    if (o === "win") {
      wins++;
      grossProfit += t.netPnl;
    } else if (o === "loss") {
      losses++;
      grossLoss += Math.abs(t.netPnl);
    } else {
      breakevens++;
    }
    best = Math.max(best, t.netPnl);
    worst = Math.min(worst, t.netPnl);
    const rr = realizedRR(t);
    if (rr !== null && Number.isFinite(rr)) rrs.push(rr);
  }

  const decided = wins + losses;
  const winRate = decided > 0 ? (wins / decided) * 100 : 0;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0;
  const winProb = decided > 0 ? wins / decided : 0;
  const lossProb = decided > 0 ? losses / decided : 0;
  const expectancy = winProb * avgWin - lossProb * avgLoss;
  const avgRR = rrs.length ? rrs.reduce((a, b) => a + b, 0) / rrs.length : null;

  // Max drawdown over the equity curve (in the order trades were logged)
  const sorted = [...trades].sort(byCreation);
  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;
  for (const t of sorted) {
    equity += t.netPnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  // Current streak (most recent chronological trades)
  let streakType: Outcome | null = null;
  let streakLen = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const o = outcome(sorted[i]);
    if (o === "breakeven") continue;
    if (streakType === null) {
      streakType = o;
      streakLen = 1;
    } else if (o === streakType) {
      streakLen++;
    } else {
      break;
    }
  }

  return {
    count,
    wins,
    losses,
    breakevens,
    winRate,
    netPnl,
    grossProfit,
    grossLoss,
    profitFactor,
    avgWin,
    avgLoss,
    expectancy,
    avgRR,
    bestTrade: count ? best : 0,
    worstTrade: count ? worst : 0,
    totalFees,
    maxDrawdown,
    currentStreak: { type: streakType, length: streakLen },
  };
}

export interface EquityPoint {
  index: number;
  label: string;
  equity: number;
  pnl: number;
}

export function equityCurve(trades: Trade[], startBalance = 0): EquityPoint[] {
  const sorted = [...trades].sort(byCreation);
  let equity = startBalance;
  const points: EquityPoint[] = [
    { index: 0, label: "Start", equity: startBalance, pnl: 0 },
  ];
  sorted.forEach((t, i) => {
    equity += t.netPnl;
    points.push({
      index: i + 1,
      label: `#${i + 1}`,
      equity,
      pnl: t.netPnl,
    });
  });
  return points;
}

export interface GroupStat {
  key: string;
  count: number;
  netPnl: number;
  winRate: number;
}

function groupBy(trades: Trade[], keyFn: (t: Trade) => string): GroupStat[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = keyFn(t);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  const out: GroupStat[] = [];
  for (const [key, group] of map) {
    const wins = group.filter((t) => t.netPnl > 0).length;
    const losses = group.filter((t) => t.netPnl < 0).length;
    const decided = wins + losses;
    out.push({
      key,
      count: group.length,
      netPnl: group.reduce((a, b) => a + b.netPnl, 0),
      winRate: decided > 0 ? (wins / decided) * 100 : 0,
    });
  }
  return out.sort((a, b) => b.netPnl - a.netPnl);
}

export function statsByAsset(trades: Trade[]): GroupStat[] {
  return groupBy(trades, (t) => t.asset || "Unknown");
}

export function statsBySession(trades: Trade[]): GroupStat[] {
  return groupBy(trades, (t) => tradeSession(t));
}

export function statsBySetup(trades: Trade[]): GroupStat[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const setups = t.setups.length ? t.setups : ["Uncategorized"];
    for (const s of setups) {
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(t);
    }
  }
  const out: GroupStat[] = [];
  for (const [key, group] of map) {
    const wins = group.filter((t) => t.netPnl > 0).length;
    const losses = group.filter((t) => t.netPnl < 0).length;
    const decided = wins + losses;
    out.push({
      key,
      count: group.length,
      netPnl: group.reduce((a, b) => a + b.netPnl, 0),
      winRate: decided > 0 ? (wins / decided) * 100 : 0,
    });
  }
  return out.sort((a, b) => b.netPnl - a.netPnl);
}

export function statsByCompliance(trades: Trade[]): GroupStat[] {
  return groupBy(trades, (t) =>
    t.compliance === "compliant"
      ? "Followed plan"
      : t.compliance === "mistake"
        ? "Rule broken"
        : "Untagged"
  );
}
