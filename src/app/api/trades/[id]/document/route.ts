import { NextResponse } from "next/server";
import { getTrade } from "@/lib/csvStore";
import { getDocument, saveDocument } from "@/lib/documentStore";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tradeId = Number(id);
  const trade = await getTrade(tradeId);
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = await getDocument(tradeId);
  return NextResponse.json(doc);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tradeId = Number(id);
  const trade = await getTrade(tradeId);
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json()) as { html?: unknown };
  const html = typeof body.html === "string" ? body.html : "";
  const doc = await saveDocument(tradeId, html);
  return NextResponse.json(doc);
}
