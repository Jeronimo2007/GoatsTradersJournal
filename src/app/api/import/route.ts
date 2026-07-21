import { NextResponse } from "next/server";
import { importCsv } from "@/lib/csvStore";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const csv = await req.text();
  if (!csv.trim()) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  try {
    const count = await importCsv(csv);
    return NextResponse.json({ imported: count });
  } catch {
    return NextResponse.json({ error: "Invalid CSV" }, { status: 400 });
  }
}
