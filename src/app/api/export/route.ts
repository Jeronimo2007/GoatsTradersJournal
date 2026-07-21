import { getCsv } from "@/lib/csvStore";

export const runtime = "nodejs";

export async function GET() {
  const csv = await getCsv();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trading-journal-${date}.csv"`,
    },
  });
}
