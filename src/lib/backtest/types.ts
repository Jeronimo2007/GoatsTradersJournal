/**
 * Backtesting / Manual Replay Tracker — data model.
 *
 * This module is intentionally self-contained and independent from the live
 * trading journal. It is optimised for *frictionless* logging: a full record
 * should take ~30 seconds to enter (toggles instead of dropdowns, no exact
 * prices/timestamps/pips).
 */

export type BtSession = "NY" | "Tokyo";
export type BtDirection = "long" | "short";
export type BtOutcome = "win" | "loss" | "be";

export interface BacktestTrade {
  id: number;

  /** ISO datetime, anchored at local noon — we only care about the day. */
  date: string;
  session: BtSession;
  direction: BtDirection;

  /** Optional quick asset tag (XAUUSD, NAS100, ...). May be "". */
  asset: string;

  /** Strategy / setup triggers (quick-select tags). */
  setups: string[];

  /** Win (TP) / Loss (SL) / Breakeven. Drives win-rate. */
  outcome: BtOutcome;

  /** Realized reward:risk in R units (e.g. -1 full loss, 0 BE, 2.5 win). */
  rr: number;

  /** Planned/expected take-profit target expressed as R:R (optional). */
  plannedRR: number | null;

  /**
   * Risk actually used on this trade, in account currency (optional). When set
   * it overrides the account's fixed risk-per-trade for the $ derivation.
   */
  riskAmount: number | null;

  /** Number of contracts / lots / units traded (optional). */
  contracts: number | null;

  /**
   * Net P/L in account currency. Optional — when null it is derived from
   * `rr * (riskAmount ?? riskPerTrade)` for analytics/calendar.
   */
  netPnl: number | null;

  /**
   * On read: a URL like "/api/backtests/images/<file>".
   * On write: a data URL for a new upload, an existing "/api/backtests/images/…"
   * URL to keep, or null to clear.
   */
  screenshot: string | null;

  /** Free-form notes: mistakes made / general thoughts. */
  notes: string;

  createdAt: string;
  updatedAt: string;
}

/** Payload used to create or update a record (no server-managed fields). */
export type BacktestTradeInput = Omit<
  BacktestTrade,
  "id" | "createdAt" | "updatedAt"
>;

/** Per-account settings for the backtesting module. */
export interface BacktestSettings {
  /** Fixed $ risked per trade — used to auto-derive Net P/L from R. */
  riskPerTrade: number;
  currency: string;
}

export const BT_SESSIONS: BtSession[] = ["NY", "Tokyo"];
export const BT_DIRECTIONS: BtDirection[] = ["long", "short"];
export const BT_OUTCOMES: BtOutcome[] = ["win", "loss", "be"];

/** Quick-select setup tags. */
export const BT_SETUP_PRESETS = ["Sistema Goat Trader"];

export const BT_ASSET_PRESETS = [
  "XAUUSD",
  "NAS100",
  "US30",
  "SPX500",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "BTCUSD",
];

export const BT_NOTE_MAX_LENGTH = 1000;

/** Default R attached to each outcome, so a loss/BE needs zero extra typing. */
export const DEFAULT_RR_BY_OUTCOME: Record<BtOutcome, number> = {
  win: 2,
  loss: -1,
  be: 0,
};

export const DEFAULT_BACKTEST_SETTINGS: BacktestSettings = {
  riskPerTrade: 100,
  currency: "USD",
};
