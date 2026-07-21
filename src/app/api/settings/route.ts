import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/csvStore";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PUT(req: Request) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.accountBalance !== undefined)
    patch.accountBalance = Number(body.accountBalance) || 0;
  if (typeof body.currency === "string") patch.currency = body.currency;
  const settings = await saveSettings(patch);
  return NextResponse.json(settings);
}
