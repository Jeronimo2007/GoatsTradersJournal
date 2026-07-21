import type {
  BacktestTrade,
  BacktestTradeInput,
  BacktestSettings,
} from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchBacktests(): Promise<BacktestTrade[]> {
  return json(await fetch("/api/backtests", { cache: "no-store" }));
}

export async function createBacktest(
  input: BacktestTradeInput
): Promise<BacktestTrade> {
  return json(
    await fetch("/api/backtests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function updateBacktest(
  id: number,
  input: BacktestTradeInput
): Promise<BacktestTrade> {
  return json(
    await fetch(`/api/backtests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function deleteBacktest(id: number): Promise<void> {
  await fetch(`/api/backtests/${id}`, { method: "DELETE" });
}

export async function clearBacktests(): Promise<void> {
  await fetch("/api/backtests", { method: "DELETE" });
}

export async function fetchBacktestSettings(): Promise<BacktestSettings> {
  return json(await fetch("/api/backtests/settings", { cache: "no-store" }));
}

export async function saveBacktestSettings(
  patch: Partial<BacktestSettings>
): Promise<BacktestSettings> {
  return json(
    await fetch("/api/backtests/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}
