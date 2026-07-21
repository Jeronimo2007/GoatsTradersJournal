import { NextResponse } from "next/server";
import {
  getBacktests,
  createBacktest,
  clearBacktests,
} from "@/lib/backtest/store";
import { parseBacktestInput } from "@/lib/backtest/parseInput";

export const runtime = "nodejs";

export async function GET() {
  const trades = await getBacktests();
  return NextResponse.json(trades);
}

export async function POST(req: Request) {
  const body = await req.json();
  const input = parseBacktestInput(body);
  const trade = await createBacktest(input);
  return NextResponse.json(trade, { status: 201 });
}

export async function DELETE() {
  await clearBacktests();
  return NextResponse.json({ ok: true });
}
