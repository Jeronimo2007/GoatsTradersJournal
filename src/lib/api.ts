import type {
  Trade,
  TradeInput,
  TradeDocument,
  Settings,
  Lesson,
  LessonInput,
  AccountsState,
} from "./types";

/** In-flight GET dedupe + short-lived response cache (per browser tab). */
const inflight = new Map<string, Promise<unknown>>();
const cacheStore = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 30_000;

export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    cacheStore.clear();
    inflight.clear();
    return;
  }
  for (const key of [...cacheStore.keys()]) {
    if (key.startsWith(prefix)) cacheStore.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

async function cachedGet<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = cacheStore.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.data as T;
  }
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = run()
    .then((data) => {
      cacheStore.set(key, { at: Date.now(), data });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, promise);
  return promise;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export type Bootstrap = {
  settings: Settings;
  trades: Trade[];
};

/** One round-trip for pages that need settings + trades together. */
export async function fetchBootstrap(): Promise<Bootstrap> {
  return cachedGet("bootstrap", async () => {
    const data = await json<Bootstrap>(
      await fetch("/api/bootstrap", { cache: "no-store" })
    );
    // Warm individual caches so later pages reuse this data.
    cacheStore.set("settings", { at: Date.now(), data: data.settings });
    cacheStore.set("trades", { at: Date.now(), data: data.trades });
    return data;
  });
}

export async function fetchTrades(): Promise<Trade[]> {
  return cachedGet("trades", async () =>
    json(await fetch("/api/trades", { cache: "no-store" }))
  );
}

export async function fetchTrade(id: number): Promise<Trade | null> {
  return cachedGet(`trade:${id}`, async () => {
    const res = await fetch(`/api/trades/${id}`, { cache: "no-store" });
    if (res.status === 404) return null;
    return json(res);
  });
}

export async function createTrade(input: TradeInput): Promise<Trade> {
  const trade = await json<Trade>(
    await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
  invalidateApiCache();
  return trade;
}

export async function updateTrade(id: number, input: TradeInput): Promise<Trade> {
  const trade = await json<Trade>(
    await fetch(`/api/trades/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
  invalidateApiCache();
  return trade;
}

export async function deleteTrade(id: number): Promise<void> {
  await fetch(`/api/trades/${id}`, { method: "DELETE" });
  invalidateApiCache();
}

export async function clearTrades(): Promise<void> {
  await fetch("/api/trades", { method: "DELETE" });
  invalidateApiCache();
}

export async function fetchTradeDocument(id: number): Promise<TradeDocument> {
  return cachedGet(`doc:${id}`, async () =>
    json(await fetch(`/api/trades/${id}/document`, { cache: "no-store" }))
  );
}

export async function saveTradeDocument(
  id: number,
  html: string
): Promise<TradeDocument> {
  const doc = await json<TradeDocument>(
    await fetch(`/api/trades/${id}/document`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html }),
    })
  );
  invalidateApiCache(`doc:${id}`);
  return doc;
}

export async function uploadTradePdf(id: number, pdf: Blob): Promise<void> {
  const res = await fetch(`/api/trades/${id}/document/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: pdf,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  invalidateApiCache(`doc:${id}`);
}

export function tradePdfUrl(
  id: number,
  opts: { download?: boolean; cacheBust?: string | number } = {}
): string {
  const params = new URLSearchParams();
  if (opts.download) params.set("download", "1");
  if (opts.cacheBust != null) params.set("v", String(opts.cacheBust));
  const qs = params.toString();
  return `/api/trades/${id}/document/pdf${qs ? `?${qs}` : ""}`;
}

export async function fetchSettings(): Promise<Settings> {
  return cachedGet("settings", async () =>
    json(await fetch("/api/settings", { cache: "no-store" }))
  );
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = await json<Settings>(
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
  invalidateApiCache("settings");
  invalidateApiCache("bootstrap");
  return next;
}

export async function fetchLessons(): Promise<Lesson[]> {
  return cachedGet("lessons", async () =>
    json(await fetch("/api/lessons", { cache: "no-store" }))
  );
}

export async function createLesson(input: LessonInput): Promise<Lesson> {
  const lesson = await json<Lesson>(
    await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
  invalidateApiCache("lessons");
  return lesson;
}

export async function updateLesson(
  id: number,
  input: Partial<LessonInput>
): Promise<Lesson> {
  const lesson = await json<Lesson>(
    await fetch(`/api/lessons/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
  invalidateApiCache("lessons");
  return lesson;
}

export async function deleteLesson(id: number): Promise<void> {
  await fetch(`/api/lessons/${id}`, { method: "DELETE" });
  invalidateApiCache("lessons");
}

export async function importCsv(csv: string): Promise<number> {
  const res = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csv,
  });
  const data = await json<{ imported: number }>(res);
  invalidateApiCache();
  return data.imported;
}

export async function fetchAccounts(): Promise<AccountsState> {
  return cachedGet("accounts", async () =>
    json(await fetch("/api/accounts", { cache: "no-store" }))
  );
}

export async function createAccount(name: string): Promise<AccountsState> {
  const state = await json<AccountsState>(
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  );
  invalidateApiCache();
  return state;
}

export async function switchAccount(activeId: string): Promise<AccountsState> {
  const state = await json<AccountsState>(
    await fetch("/api/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeId }),
    })
  );
  invalidateApiCache();
  return state;
}

export async function renameAccount(
  id: string,
  name: string
): Promise<AccountsState> {
  const state = await json<AccountsState>(
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
  );
  invalidateApiCache("accounts");
  return state;
}

export async function deleteAccount(id: string): Promise<AccountsState> {
  const state = await json<AccountsState>(
    await fetch(`/api/accounts/${id}`, { method: "DELETE" })
  );
  invalidateApiCache();
  return state;
}
