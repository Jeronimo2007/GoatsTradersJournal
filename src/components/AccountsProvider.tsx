"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchAccounts,
  createAccount as apiCreateAccount,
  switchAccount as apiSwitchAccount,
  renameAccount as apiRenameAccount,
  deleteAccount as apiDeleteAccount,
} from "@/lib/api";
import type { Account, AccountsState } from "@/lib/types";

type AccountsContextValue = {
  accounts: Account[];
  activeId: string;
  loading: boolean;
  refresh: () => Promise<void>;
  switchTo: (id: string) => Promise<void>;
  create: (name: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<AccountsState | null>;
  remove: (id: string) => Promise<AccountsState | null>;
  applyState: (state: AccountsState) => void;
};

const AccountsContext = createContext<AccountsContextValue | null>(null);

export function AccountsProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);

  const applyState = useCallback((state: AccountsState) => {
    setAccounts(state.accounts);
    setActiveId(state.activeId);
  }, []);

  const refresh = useCallback(async () => {
    const state = await fetchAccounts();
    applyState(state);
  }, [applyState]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAccounts()
      .then((state) => {
        if (!cancelled) applyState(state);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyState]);

  const switchTo = useCallback(async (id: string) => {
    await apiSwitchAccount(id);
    // Full reload so every page picks up the new account's data.
    window.location.reload();
  }, []);

  const create = useCallback(async (name: string) => {
    await apiCreateAccount(name);
    window.location.reload();
  }, []);

  const rename = useCallback(
    async (id: string, name: string) => {
      const state = await apiRenameAccount(id, name);
      applyState(state);
      return state;
    },
    [applyState]
  );

  const remove = useCallback(
    async (id: string) => {
      const state = await apiDeleteAccount(id);
      applyState(state);
      // Deleting the active account switches active id server-side — reload.
      window.location.reload();
      return state;
    },
    [applyState]
  );

  const value = useMemo(
    () => ({
      accounts,
      activeId,
      loading,
      refresh,
      switchTo,
      create,
      rename,
      remove,
      applyState,
    }),
    [
      accounts,
      activeId,
      loading,
      refresh,
      switchTo,
      create,
      rename,
      remove,
      applyState,
    ]
  );

  return (
    <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
  );
}

export function useAccounts() {
  const ctx = useContext(AccountsContext);
  if (!ctx) {
    throw new Error("useAccounts must be used within AccountsProvider");
  }
  return ctx;
}
