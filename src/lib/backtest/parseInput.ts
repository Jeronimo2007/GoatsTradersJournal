import type {
  BacktestTradeInput,
  BtSession,
  BtDirection,
  BtOutcome,
} from "./types";
import { BT_NOTE_MAX_LENGTH } from "./types";

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const toNumOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const toStr = (v: unknown): string => (typeof v === "string" ? v : "");

/** Coerce an untrusted request body into a well-formed BacktestTradeInput. */
export function parseBacktestInput(
  body: Record<string, unknown>
): BacktestTradeInput {
  const session: BtSession = body.session === "Tokyo" ? "Tokyo" : "NY";
  const direction: BtDirection = body.direction === "short" ? "short" : "long";
  const outcome: BtOutcome =
    body.outcome === "loss" ? "loss" : body.outcome === "be" ? "be" : "win";

  const setups = Array.isArray(body.setups)
    ? body.setups.map((s) => String(s)).filter(Boolean)
    : [];

  const screenshot =
    typeof body.screenshot === "string" && body.screenshot.length
      ? body.screenshot
      : null;

  return {
    date: toStr(body.date) || new Date().toISOString(),
    session,
    direction,
    asset: toStr(body.asset).trim().toUpperCase(),
    setups,
    outcome,
    rr: toNum(body.rr),
    plannedRR: toNumOrNull(body.plannedRR),
    riskAmount: toNumOrNull(body.riskAmount),
    contracts: toNumOrNull(body.contracts),
    netPnl: toNumOrNull(body.netPnl),
    screenshot,
    notes: toStr(body.notes).slice(0, BT_NOTE_MAX_LENGTH),
  };
}
