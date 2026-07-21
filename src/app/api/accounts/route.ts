import { NextResponse } from "next/server";
import {
  getAccountsState,
  createAccount,
  setActiveAccount,
} from "@/lib/accountsStore";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getAccountsState());
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name : "";
  const state = await createAccount(name);
  return NextResponse.json(state, { status: 201 });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const activeId = typeof body?.activeId === "string" ? body.activeId : "";
  const state = await setActiveAccount(activeId);
  if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(state);
}
