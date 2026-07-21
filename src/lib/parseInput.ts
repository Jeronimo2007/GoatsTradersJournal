import type { TradeInput, Direction, OrderType, Compliance } from "./types";

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
const toBool = (v: unknown): boolean => v === true || v === "true";

/** Coerce an untrusted request body into a well-formed TradeInput. */
export function parseTradeInput(body: Record<string, unknown>): TradeInput {
  const direction: Direction = body.direction === "short" ? "short" : "long";
  const orderType: OrderType =
    body.orderType === "limit" || body.orderType === "stop"
      ? (body.orderType as OrderType)
      : "market";
  const compliance: Compliance | null =
    body.compliance === "compliant" || body.compliance === "mistake"
      ? (body.compliance as Compliance)
      : null;

  const setups = Array.isArray(body.setups)
    ? body.setups.map((s) => String(s)).filter(Boolean)
    : [];

  const screenshot = (v: unknown): string | null =>
    typeof v === "string" && v.length ? v : null;

  return {
    openedAt: toStr(body.openedAt) || new Date().toISOString(),
    closedAt: toStr(body.closedAt) || new Date().toISOString(),
    session: toStr(body.session),
    asset: toStr(body.asset).trim().toUpperCase(),
    direction,
    entryPrice: toNum(body.entryPrice),
    exitPrice: toNum(body.exitPrice),
    stopLoss: toNumOrNull(body.stopLoss),
    takeProfit: toNumOrNull(body.takeProfit),
    positionSize: toNum(body.positionSize),
    netPnl: toNum(body.netPnl),
    netPnlPercent: toNumOrNull(body.netPnlPercent),
    fees: toNum(body.fees),
    setups,
    orderType,
    screenshotBefore: screenshot(body.screenshotBefore),
    screenshotAfter: screenshot(body.screenshotAfter),
    movedToBreakEven: toBool(body.movedToBreakEven),
    tookPartials: toBool(body.tookPartials),
    closedManually: toBool(body.closedManually),
    managementNotes: toStr(body.managementNotes),
    preTradeMindset: toStr(body.preTradeMindset),
    inTradeBehavior: toStr(body.inTradeBehavior),
    postTradeReview: toStr(body.postTradeReview),
    compliance,
  };
}
