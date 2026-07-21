import "server-only";
import { getActiveAccountId } from "@/lib/accountsStore";
import { BUCKETS, requireUser } from "@/lib/supabase/server";
import {
  downloadBytes,
  objectPath,
  parseDataUrl,
  removeObject,
  uploadBytes,
} from "@/lib/supabase/storage";
import type {
  BacktestTrade,
  BacktestTradeInput,
  BacktestSettings,
  BtSession,
  BtDirection,
  BtOutcome,
} from "./types";
import { DEFAULT_BACKTEST_SETTINGS } from "./types";

const IMAGE_URL_PREFIX = "/api/backtests/images/";

interface BtRow {
  id: number;
  user_id: string;
  account_id: string;
  date: string;
  session: BtSession;
  direction: BtDirection;
  asset: string;
  setups: string[] | unknown;
  outcome: BtOutcome;
  rr: number;
  planned_rr: number | null;
  risk_amount: number | null;
  contracts: number | null;
  net_pnl: number | null;
  screenshot: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

function setupsOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}

function numOrNull(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToTrade(r: BtRow): BacktestTrade {
  return {
    id: Number(r.id),
    date: r.date ?? "",
    session: r.session === "Tokyo" ? "Tokyo" : "NY",
    direction: r.direction === "short" ? "short" : "long",
    asset: r.asset ?? "",
    setups: setupsOf(r.setups),
    outcome: r.outcome === "loss" ? "loss" : r.outcome === "be" ? "be" : "win",
    rr: Number(r.rr) || 0,
    plannedRR: numOrNull(r.planned_rr),
    riskAmount: numOrNull(r.risk_amount),
    contracts: numOrNull(r.contracts),
    netPnl: numOrNull(r.net_pnl),
    screenshot: r.screenshot ? IMAGE_URL_PREFIX + r.screenshot : null,
    notes: r.notes ?? "",
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
  };
}

function inputToDb(
  input: BacktestTradeInput,
  userId: string,
  accountId: string,
  screenshot: string,
  extras: { created_at?: string; updated_at: string }
) {
  return {
    user_id: userId,
    account_id: accountId,
    date: input.date,
    session: input.session,
    direction: input.direction,
    asset: input.asset,
    setups: input.setups,
    outcome: input.outcome,
    rr: input.rr,
    planned_rr: input.plannedRR,
    risk_amount: input.riskAmount,
    contracts: input.contracts,
    net_pnl: input.netPnl,
    screenshot,
    notes: input.notes,
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
    BUCKETS.backtestImages,
    objectPath(userId, accountId, filename)
  );
}

async function resolveImage(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  accountId: string,
  value: string | null,
  id: number,
  previous: string
): Promise<string> {
  if (value && value.startsWith(IMAGE_URL_PREFIX)) {
    return value.slice(IMAGE_URL_PREFIX.length);
  }

  if (value && value.startsWith("data:")) {
    const parsed = parseDataUrl(value);
    if (parsed) {
      const filename = `bt_${id}_${Date.now()}.${parsed.ext}`;
      await uploadBytes(
        supabase,
        BUCKETS.backtestImages,
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
    BUCKETS.backtestImages,
    objectPath(user.id, accountId, safe)
  );
}

export async function getBacktests(): Promise<BacktestTrade[]> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const { data, error } = await supabase
    .from("backtest_trades")
    .select("*")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .order("id", { ascending: true });
  if (error) throw new Error(`Failed to load backtests: ${error.message}`);
  return ((data ?? []) as BtRow[]).map(rowToTrade);
}

export async function getBacktest(id: number): Promise<BacktestTrade | null> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const { data, error } = await supabase
    .from("backtest_trades")
    .select("*")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load backtest: ${error.message}`);
  return data ? rowToTrade(data as BtRow) : null;
}

export async function createBacktest(
  input: BacktestTradeInput
): Promise<BacktestTrade> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const now = new Date().toISOString();

  const { data: inserted, error } = await supabase
    .from("backtest_trades")
    .insert(
      inputToDb(input, user.id, accountId, "", {
        created_at: now,
        updated_at: now,
      })
    )
    .select("*")
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to create backtest: ${error?.message ?? "unknown"}`);
  }

  const id = Number((inserted as BtRow).id);
  const screenshot = await resolveImage(
    supabase,
    user.id,
    accountId,
    input.screenshot,
    id,
    ""
  );

  if (screenshot) {
    const { data: updated, error: updateError } = await supabase
      .from("backtest_trades")
      .update({ screenshot })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (updateError || !updated) {
      throw new Error(`Failed to attach screenshot: ${updateError?.message}`);
    }
    return rowToTrade(updated as BtRow);
  }

  return rowToTrade(inserted as BtRow);
}

export async function updateBacktest(
  id: number,
  input: BacktestTradeInput
): Promise<BacktestTrade | null> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();

  const { data: existing, error: loadError } = await supabase
    .from("backtest_trades")
    .select("*")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new Error(`Failed to load backtest: ${loadError.message}`);
  if (!existing) return null;

  const row = existing as BtRow;
  const screenshot = await resolveImage(
    supabase,
    user.id,
    accountId,
    input.screenshot,
    id,
    row.screenshot
  );

  const { data: updated, error } = await supabase
    .from("backtest_trades")
    .update(
      inputToDb(input, user.id, accountId, screenshot, {
        updated_at: new Date().toISOString(),
      })
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update backtest: ${error.message}`);
  return updated ? rowToTrade(updated as BtRow) : null;
}

export async function deleteBacktest(id: number): Promise<boolean> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();

  const { data: existing } = await supabase
    .from("backtest_trades")
    .select("screenshot")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return false;

  await deleteImage(supabase, user.id, accountId, (existing as BtRow).screenshot);

  const { error } = await supabase
    .from("backtest_trades")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to delete backtest: ${error.message}`);
  return true;
}

export async function clearBacktests(): Promise<void> {
  const rows = await getBacktests();
  for (const r of rows) await deleteBacktest(r.id);
}

export async function getBacktestSettings(): Promise<BacktestSettings> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const { data, error } = await supabase
    .from("accounts")
    .select("bt_risk_per_trade, bt_currency")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();
  if (error || !data) return { ...DEFAULT_BACKTEST_SETTINGS };
  return {
    riskPerTrade:
      Number(data.bt_risk_per_trade) || DEFAULT_BACKTEST_SETTINGS.riskPerTrade,
    currency: data.bt_currency || DEFAULT_BACKTEST_SETTINGS.currency,
  };
}

export async function saveBacktestSettings(
  patch: Partial<BacktestSettings>
): Promise<BacktestSettings> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const current = await getBacktestSettings();
  const next = { ...current, ...patch };
  const { error } = await supabase
    .from("accounts")
    .update({
      bt_risk_per_trade: next.riskPerTrade,
      bt_currency: next.currency,
    })
    .eq("id", accountId)
    .eq("user_id", user.id);
  if (error) {
    throw new Error(`Failed to save backtest settings: ${error.message}`);
  }
  return next;
}
