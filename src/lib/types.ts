export type Direction = "long" | "short";
export type OrderType = "market" | "limit" | "stop";
export type Compliance = "compliant" | "mistake";

export interface Trade {
  id: number;

  // --- 1. Quantitative Data ---
  openedAt: string; // ISO datetime (entry). Now stores the trade day only.
  closedAt: string; // ISO datetime (exit). Now stores the trade day only.
  session: string; // trading session, e.g. "New York" / "Tokyo"
  asset: string; // ticker, e.g. XAUUSD
  direction: Direction; // long / short
  entryPrice: number;
  exitPrice: number;
  stopLoss: number | null; // planned risk in $ (expected loss if SL is hit)
  takeProfit: number | null; // planned reward in $ (expected profit if TP is hit)
  positionSize: number; // lots / contracts / units
  netPnl: number; // net P/L in account currency ($)
  netPnlPercent: number | null; // % of account balance (optional / auto)
  fees: number; // commission + swap + fees

  // --- 2. Qualitative Data ---
  setups: string[]; // strategy triggers (MSS, FVG, liquidity sweep, ...)
  orderType: OrderType;
  // On read: a URL like "/api/images/<file>". On write: a data URL for a new
  // upload, an existing "/api/images/..." URL to keep, or null to clear.
  screenshotBefore: string | null;
  screenshotAfter: string | null;
  movedToBreakEven: boolean;
  tookPartials: boolean;
  closedManually: boolean;
  managementNotes: string;

  // --- 3. Psychological Log ---
  preTradeMindset: string;
  inTradeBehavior: string;
  postTradeReview: string;
  compliance: Compliance | null;

  createdAt: string;
  updatedAt: string;
}

/** Payload used to create or update a trade (no server-managed fields). */
export type TradeInput = Omit<Trade, "id" | "createdAt" | "updatedAt">;

/** A free-form rich journal document attached to a single trade. */
export interface TradeDocument {
  html: string; // editor content; images are inlined as data URLs
  hasPdf: boolean; // whether an exported PDF is stored for this trade
  updatedAt: string | null; // last time the document was saved
  pdfUpdatedAt: string | null; // last time the PDF was exported
}

export interface Settings {
  accountBalance: number; // used to auto-compute PnL % and equity baseline
  currency: string;
}

/** A trading account (e.g. a funded account). Each has isolated data. */
export interface Account {
  id: string;
  name: string;
  createdAt: string;
}

export interface AccountsState {
  accounts: Account[];
  activeId: string;
}

/** A short lesson / learning, posted journal-style (like a tweet). Shared with all users. */
export interface Lesson {
  id: number;
  text: string;
  tags: string[]; // derived from #hashtags in the text
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
  isMine: boolean;
}

/** Payload used to create or update a lesson (no server-managed fields). */
export type LessonInput = { text: string; pinned?: boolean };

export const LESSON_MAX_LENGTH = 500;

export const SESSION_PRESETS = ["New York", "Tokyo"];

export const SETUP_PRESETS = ["Sistema Goat Trader"];

export const ASSET_PRESETS = [
  "XAUUSD",
  "NAS100",
  "US30",
  "SPX500",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "BTCUSD",
  "ETHUSD",
];
