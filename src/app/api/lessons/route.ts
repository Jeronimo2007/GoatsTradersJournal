import { NextResponse } from "next/server";
import { getLessons, createLesson } from "@/lib/lessonsStore";

export const runtime = "nodejs";

export async function GET() {
  const lessons = await getLessons();
  return NextResponse.json(lessons);
}

export async function POST(req: Request) {
  const body = await req.json();
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  const lesson = await createLesson({ text, pinned: body?.pinned === true });
  return NextResponse.json(lesson, { status: 201 });
}
