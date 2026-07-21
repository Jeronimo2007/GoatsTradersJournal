import { NextResponse } from "next/server";
import { getTrades, getSettings } from "@/lib/csvStore";

export const runtime = "nodejs";

/** Single round-trip for dashboard / trades list boot. */
export async function GET() {
  const [settings, trades] = await Promise.all([getSettings(), getTrades()]);
  return NextResponse.json({ settings, trades });
}
