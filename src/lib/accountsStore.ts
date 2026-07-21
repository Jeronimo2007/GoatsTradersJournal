import "server-only";
import { cache } from "react";
import type { Account, AccountsState } from "./types";
import { requireUser } from "./supabase/server";

function newId(): string {
  return `acc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

interface AccountRow {
  id: string;
  name: string;
  created_at: string;
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

async function ensureState(): Promise<AccountsState> {
  const { supabase, user } = await requireUser();

  const { data: accountData, error } = await supabase
    .from("accounts")
    .select("id, name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load accounts: ${error.message}`);

  let rows = (accountData ?? []) as AccountRow[];

  if (rows.length === 0) {
    const account = {
      id: newId(),
      user_id: user.id,
      name: "Main Account",
      created_at: new Date().toISOString(),
    };
    const { error: insertError } = await supabase.from("accounts").insert(account);
    if (insertError) {
      throw new Error(`Failed to create default account: ${insertError.message}`);
    }
    rows = [
      { id: account.id, name: account.name, created_at: account.created_at },
    ];
    await supabase
      .from("profiles")
      .update({
        active_account_id: account.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_account_id")
    .eq("id", user.id)
    .maybeSingle();

  let activeId = (profile as { active_account_id: string | null } | null)
    ?.active_account_id ?? null;

  if (!activeId || !rows.some((r) => r.id === activeId)) {
    activeId = rows[0].id;
    await supabase
      .from("profiles")
      .update({
        active_account_id: activeId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  return {
    accounts: rows.map(toAccount),
    activeId,
  };
}

export async function getAccountsState(): Promise<AccountsState> {
  return ensureState();
}

/**
 * Fast path: one profile row. Falls back to full ensureState only when the
 * profile has no active account yet. Deduped per request.
 */
export const getActiveAccountId = cache(async (): Promise<string> => {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("active_account_id")
    .eq("id", user.id)
    .maybeSingle();

  const activeId = (data as { active_account_id: string | null } | null)
    ?.active_account_id;

  if (activeId) return activeId;
  return (await ensureState()).activeId;
});

export async function createAccount(name: string): Promise<AccountsState> {
  const { supabase, user } = await requireUser();
  const state = await ensureState();
  const account = {
    id: newId(),
    user_id: user.id,
    name: name.trim() || `Account ${state.accounts.length + 1}`,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("accounts").insert(account);
  if (error) throw new Error(`Failed to create account: ${error.message}`);

  await supabase
    .from("profiles")
    .update({
      active_account_id: account.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  return ensureState();
}

export async function renameAccount(
  id: string,
  name: string
): Promise<AccountsState | null> {
  const { supabase, user } = await requireUser();
  const state = await ensureState();
  if (!state.accounts.some((a) => a.id === id)) return null;

  const { error } = await supabase
    .from("accounts")
    .update({
      name: name.trim() || state.accounts.find((a) => a.id === id)!.name,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to rename account: ${error.message}`);

  return ensureState();
}

export async function setActiveAccount(
  id: string
): Promise<AccountsState | null> {
  const { supabase, user } = await requireUser();
  const state = await ensureState();
  if (!state.accounts.some((a) => a.id === id)) return null;

  const { error } = await supabase
    .from("profiles")
    .update({ active_account_id: id, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw new Error(`Failed to switch account: ${error.message}`);

  return ensureState();
}

export async function deleteAccount(
  id: string
): Promise<AccountsState | null> {
  const { supabase, user } = await requireUser();
  const state = await ensureState();
  if (!state.accounts.some((a) => a.id === id)) return null;
  if (state.accounts.length <= 1) return null;

  const next = state.accounts.find((a) => a.id !== id)!;

  if (state.activeId === id) {
    await supabase
      .from("profiles")
      .update({
        active_account_id: next.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to delete account: ${error.message}`);

  return ensureState();
}
