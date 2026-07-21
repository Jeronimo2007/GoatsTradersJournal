import { NextResponse } from "next/server";
import {
  getBacktestSettings,
  saveBacktestSettings,
} from "@/lib/backtest/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getBacktestSettings());
}

export async function PUT(req: Request) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.riskPerTrade !== undefined) {
    const n = Number(body.riskPerTrade);
    if (Number.isFinite(n) && n >= 0) patch.riskPerTrade = n;
  }
  if (typeof body.currency === "string") patch.currency = body.currency;
  return NextResponse.json(await saveBacktestSettings(patch));
}
