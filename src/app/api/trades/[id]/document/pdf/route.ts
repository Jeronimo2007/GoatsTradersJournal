import { NextResponse } from "next/server";
import { getTrade } from "@/lib/csvStore";
import { readPdf, savePdf } from "@/lib/documentStore";

export const runtime = "nodejs";

// Guard against runaway uploads (~25 MB).
const MAX_PDF_BYTES = 25 * 1024 * 1024;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tradeId = Number(id);
  const pdf = await readPdf(tradeId);
  if (!pdf) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const filename = `trade-${tradeId}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tradeId = Number(id);
  const trade = await getTrade(tradeId);
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0)
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  if (buf.length > MAX_PDF_BYTES)
    return NextResponse.json({ error: "PDF too large" }, { status: 413 });
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-")
    return NextResponse.json({ error: "Not a PDF" }, { status: 400 });

  await savePdf(tradeId, buf);
  return NextResponse.json({ ok: true });
}
