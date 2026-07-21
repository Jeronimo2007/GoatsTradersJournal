import "server-only";
import Papa from "papaparse";
import type {
  Trade,
  TradeInput,
  Settings,
  Compliance,
  Direction,
  OrderType,
} from "./types";
import { getActiveAccountId } from "./accountsStore";
import { deleteDocument } from "./documentStore";
import { BUCKETS, requireUser } from "./supabase/server";
import {
  downloadBytes,
  objectPath,
  parseDataUrl,
  removeObject,
  uploadBytes,
} from "./supabase/storage";

const COLUMNS = [
  "id",
  "openedAt",
  "closedAt",
  "session",
  "asset",
  "direction",
  "entryPrice",
  "exitPrice",
  "stopLoss",
  "takeProfit",
  "positionSize",
  "netPnl",
  "netPnlPercent",
  "fees",
  "setups",
  "orderType",
  "screenshotBefore",
  "screenshotAfter",
  "movedToBreakEven",
  "tookPartials",
  "closedManually",
  "managementNotes",
  "preTradeMindset",
  "inTradeBehavior",
  "postTradeReview",
  "compliance",
  "createdAt",
  "updatedAt",
] as const;

const IMAGE_URL_PREFIX = "/api/images/";

interface TradeRow {
  id: number;
  user_id: string;
  account_id: string;
  opened_at: string;
  closed_at: string;
  session: string;
  asset: string;
  direction: Direction;
  entry_price: number;
  exit_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number;
  net_pnl: number;
  net_pnl_percent: number | null;
  fees: number;
  setups: string[] | unknown;
  order_type: OrderType;
  screenshot_before: string;
  screenshot_after: string;
  moved_to_break_even: boolean;
  took_partials: boolean;
  closed_manually: boolean;
  management_notes: string;
  pre_trade_mindset: string;
  in_trade_behavior: string;
  post_trade_review: string;
  compliance: Compliance | null;
  created_at: string;
  updated_at: string;
}

function setupsOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}

function rowToTrade(r: TradeRow): Trade {
  return {
    id: Number(r.id),
    openedAt: r.opened_at ?? "",
    closedAt: r.closed_at ?? "",
    session: r.session ?? "",
    asset: r.asset ?? "",
    direction: r.direction || "long",
    entryPrice: Number(r.entry_price) || 0,
    exitPrice: Number(r.exit_price) || 0,
    stopLoss: r.stop_loss == null ? null : Number(r.stop_loss),
    takeProfit: r.take_profit == null ? null : Number(r.take_profit),
    positionSize: Number(r.position_size) || 0,
    netPnl: Number(r.net_pnl) || 0,
    netPnlPercent: r.net_pnl_percent == null ? null : Number(r.net_pnl_percent),
    fees: Number(r.fees) || 0,
    setups: setupsOf(r.setups),
    orderType: r.order_type || "market",
    screenshotBefore: r.screenshot_before
      ? IMAGE_URL_PREFIX + r.screenshot_before
      : null,
    screenshotAfter: r.screenshot_after
      ? IMAGE_URL_PREFIX + r.screenshot_after
      : null,
    movedToBreakEven: !!r.moved_to_break_even,
    tookPartials: !!r.took_partials,
    closedManually: !!r.closed_manually,
    managementNotes: r.management_notes ?? "",
    preTradeMindset: r.pre_trade_mindset ?? "",
    inTradeBehavior: r.in_trade_behavior ?? "",
    postTradeReview: r.post_trade_review ?? "",
    compliance: r.compliance ?? null,
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
  };
}

function inputToDb(
  input: TradeInput,
  userId: string,
  accountId: string,
  extras: {
    screenshot_before: string;
    screenshot_after: string;
    created_at?: string;
    updated_at: string;
  }
) {
  return {
    user_id: userId,
    account_id: accountId,
    opened_at: input.openedAt,
    closed_at: input.closedAt,
    session: input.session,
    asset: input.asset,
    direction: input.direction,
    entry_price: input.entryPrice,
    exit_price: input.exitPrice,
    stop_loss: input.stopLoss,
    take_profit: input.takeProfit,
    position_size: input.positionSize,
    net_pnl: input.netPnl,
    net_pnl_percent: input.netPnlPercent,
    fees: input.fees,
    setups: input.setups,
    order_type: input.orderType,
    screenshot_before: extras.screenshot_before,
    screenshot_after: extras.screenshot_after,
    moved_to_break_even: input.movedToBreakEven,
    took_partials: input.tookPartials,
    closed_manually: input.closedManually,
    management_notes: input.managementNotes,
    pre_trade_mindset: input.preTradeMindset,
    in_trade_behavior: input.inTradeBehavior,
    post_trade_review: input.postTradeReview,
    compliance: input.compliance,
    ...(extras.created_at ? { created_at: extras.created_at } : {}),
    updated_at: extras.updated_at,
  };
}

async function deleteImage(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  accountId: string,
  filename: string
): Promise<void> {
  if (!filename) return;
  await removeObject(
    supabase,
    BUCKETS.tradeImages,
    objectPath(userId, accountId, filename)
  );
}

async function resolveImage(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  accountId: string,
  value: string | null,
  id: number,
  kind: "before" | "after",
  previous: string
): Promise<string> {
  if (value && value.startsWith(IMAGE_URL_PREFIX)) {
    return value.slice(IMAGE_URL_PREFIX.length);
  }

  if (value && value.startsWith("data:")) {
    const parsed = parseDataUrl(value);
    if (parsed) {
      const filename = `${id}_${kind}_${Date.now()}.${parsed.ext}`;
      await uploadBytes(
        supabase,
        BUCKETS.tradeImages,
        objectPath(userId, accountId, filename),
        parsed.buffer,
        parsed.mime
      );
      if (previous && previous !== filename) {
        await deleteImage(supabase, userId, accountId, previous);
      }
      return filename;
    }
  }

  if (previous) await deleteImage(supabase, userId, accountId, previous);
  return "";
}

export async function readImage(
  filename: string
): Promise<{ data: Buffer; contentType: string } | null> {
  const safe = filename.replace(/[/\\]/g, "");
  if (!safe) return null;
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  return downloadBytes(
    supabase,
    BUCKETS.tradeImages,
    objectPath(user.id, accountId, safe)
  );
}

export async function getTrades(): Promise<Trade[]> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .order("id", { ascending: true });
  if (error) throw new Error(`Failed to load trades: ${error.message}`);
  return ((data ?? []) as TradeRow[]).map(rowToTrade);
}

export async function getTrade(id: number): Promise<Trade | null> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load trade: ${error.message}`);
  return data ? rowToTrade(data as TradeRow) : null;
}

export async function createTrade(input: TradeInput): Promise<Trade> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const now = new Date().toISOString();

  const { data: inserted, error } = await supabase
    .from("trades")
    .insert(
      inputToDb(input, user.id, accountId, {
        screenshot_before: "",
        screenshot_after: "",
        created_at: now,
        updated_at: now,
      })
    )
    .select("*")
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to create trade: ${error?.message ?? "unknown"}`);
  }

  const id = Number((inserted as TradeRow).id);
  const before = await resolveImage(
    supabase,
    user.id,
    accountId,
    input.screenshotBefore,
    id,
    "before",
    ""
  );
  const after = await resolveImage(
    supabase,
    user.id,
    accountId,
    input.screenshotAfter,
    id,
    "after",
    ""
  );

  if (before || after) {
    const { data: updated, error: updateError } = await supabase
      .from("trades")
      .update({ screenshot_before: before, screenshot_after: after })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (updateError || !updated) {
      throw new Error(`Failed to attach screenshots: ${updateError?.message}`);
    }
    return rowToTrade(updated as TradeRow);
  }

  return rowToTrade(inserted as TradeRow);
}

export async function updateTrade(
  id: number,
  input: TradeInput
): Promise<Trade | null> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();

  const { data: existing, error: loadError } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new Error(`Failed to load trade: ${loadError.message}`);
  if (!existing) return null;

  const row = existing as TradeRow;
  const before = await resolveImage(
    supabase,
    user.id,
    accountId,
    input.screenshotBefore,
    id,
    "before",
    row.screenshot_before
  );
  const after = await resolveImage(
    supabase,
    user.id,
    accountId,
    input.screenshotAfter,
    id,
    "after",
    row.screenshot_after
  );

  const { data: updated, error } = await supabase
    .from("trades")
    .update(
      inputToDb(input, user.id, accountId, {
        screenshot_before: before,
        screenshot_after: after,
        updated_at: new Date().toISOString(),
      })
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update trade: ${error.message}`);
  return updated ? rowToTrade(updated as TradeRow) : null;
}

export async function deleteTrade(id: number): Promise<boolean> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();

  const { data: existing } = await supabase
    .from("trades")
    .select("screenshot_before, screenshot_after")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return false;

  const row = existing as Pick<TradeRow, "screenshot_before" | "screenshot_after">;
  await deleteImage(supabase, user.id, accountId, row.screenshot_before);
  await deleteImage(supabase, user.id, accountId, row.screenshot_after);
  await deleteDocument(id);

  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to delete trade: ${error.message}`);
  return true;
}

export async function clearTrades(): Promise<void> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();

  const { data: rows } = await supabase
    .from("trades")
    .select("id, screenshot_before, screenshot_after")
    .eq("user_id", user.id)
    .eq("account_id", accountId);

  const list = (rows ?? []) as Pick<
    TradeRow,
    "id" | "screenshot_before" | "screenshot_after"
  >[];

  await Promise.all(
    list.flatMap((r) => [
      deleteImage(supabase, user.id, accountId, r.screenshot_before),
      deleteImage(supabase, user.id, accountId, r.screenshot_after),
      deleteDocument(Number(r.id)),
    ])
  );

  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("user_id", user.id)
    .eq("account_id", accountId);
  if (error) throw new Error(`Failed to clear trades: ${error.message}`);
}

export async function getCsv(): Promise<string> {
  const trades = await getTrades();
  const data = trades.map((t) => ({
    id: t.id,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    session: t.session,
    asset: t.asset,
    direction: t.direction,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    stopLoss: t.stopLoss ?? "",
    takeProfit: t.takeProfit ?? "",
    positionSize: t.positionSize,
    netPnl: t.netPnl,
    netPnlPercent: t.netPnlPercent ?? "",
    fees: t.fees,
    setups: JSON.stringify(t.setups),
    orderType: t.orderType,
    screenshotBefore: t.screenshotBefore
      ? t.screenshotBefore.slice(IMAGE_URL_PREFIX.length)
      : "",
    screenshotAfter: t.screenshotAfter
      ? t.screenshotAfter.slice(IMAGE_URL_PREFIX.length)
      : "",
    movedToBreakEven: t.movedToBreakEven,
    tookPartials: t.tookPartials,
    closedManually: t.closedManually,
    managementNotes: t.managementNotes,
    preTradeMindset: t.preTradeMindset,
    inTradeBehavior: t.inTradeBehavior,
    postTradeReview: t.postTradeReview,
    compliance: t.compliance ?? "",
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
  return Papa.unparse(data, { columns: COLUMNS as unknown as string[] });
}

export async function importCsv(csv: string): Promise<number> {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const incoming = (result.data || []).filter(
    (r) => r.id !== undefined && r.id !== ""
  );
  if (incoming.length === 0) return 0;

  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const now = new Date().toISOString();

  const num = (v: string | undefined) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const numOrNull = (v: string | undefined) => {
    if (v === undefined || v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (v: string | undefined) => v === "true";
  const parseSetups = (v: string | undefined): string[] => {
    if (!v) return [];
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return v
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  const rows = incoming.map((r) => ({
    user_id: user.id,
    account_id: accountId,
    opened_at: r.openedAt ?? "",
    closed_at: r.closedAt ?? "",
    session: r.session ?? "",
    asset: r.asset ?? "",
    direction: (r.direction as Direction) || "long",
    entry_price: num(r.entryPrice),
    exit_price: num(r.exitPrice),
    stop_loss: numOrNull(r.stopLoss),
    take_profit: numOrNull(r.takeProfit),
    position_size: num(r.positionSize),
    net_pnl: num(r.netPnl),
    net_pnl_percent: numOrNull(r.netPnlPercent),
    fees: num(r.fees),
    setups: parseSetups(r.setups),
    order_type: (r.orderType as OrderType) || "market",
    screenshot_before: r.screenshotBefore ?? "",
    screenshot_after: r.screenshotAfter ?? "",
    moved_to_break_even: bool(r.movedToBreakEven),
    took_partials: bool(r.tookPartials),
    closed_manually: bool(r.closedManually),
    management_notes: r.managementNotes ?? "",
    pre_trade_mindset: r.preTradeMindset ?? "",
    in_trade_behavior: r.inTradeBehavior ?? "",
    post_trade_review: r.postTradeReview ?? "",
    compliance: (r.compliance as Compliance) || null,
    created_at: r.createdAt || now,
    updated_at: now,
  }));

  const { error } = await supabase.from("trades").insert(rows);
  if (error) throw new Error(`Failed to import trades: ${error.message}`);
  return rows.length;
}

const DEFAULT_SETTINGS: Settings = { accountBalance: 10000, currency: "USD" };

export async function getSettings(): Promise<Settings> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const { data, error } = await supabase
    .from("accounts")
    .select("account_balance, currency")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();
  if (error || !data) return { ...DEFAULT_SETTINGS };
  return {
    accountBalance:
      Number(data.account_balance) || DEFAULT_SETTINGS.accountBalance,
    currency: data.currency || DEFAULT_SETTINGS.currency,
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const current = await getSettings();
  const next = { ...current, ...patch };
  const { error } = await supabase
    .from("accounts")
    .update({
      account_balance: next.accountBalance,
      currency: next.currency,
    })
    .eq("id", accountId)
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to save settings: ${error.message}`);
  return next;
}
