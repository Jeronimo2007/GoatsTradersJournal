import { NextResponse } from "next/server";
import { getTrades, createTrade, clearTrades } from "@/lib/csvStore";
import { parseTradeInput } from "@/lib/parseInput";

export const runtime = "nodejs";

export async function GET() {
  const trades = await getTrades();
  return NextResponse.json(trades);
}

export async function POST(req: Request) {
  const body = await req.json();
  const input = parseTradeInput(body);
  const trade = await createTrade(input);
  return NextResponse.json(trade, { status: 201 });
}

export async function DELETE() {
  await clearTrades();
  return NextResponse.json({ ok: true });
}
