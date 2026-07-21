import { NextResponse } from "next/server";
import { getLesson, updateLesson, deleteLesson } from "@/lib/lessonsStore";
import type { LessonInput } from "@/lib/types";

export const runtime = "nodejs";


export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lesson = await getLesson(Number(id));
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lesson);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const input: Partial<LessonInput> = {};
  if (typeof body?.text === "string") input.text = body.text;
  if (body?.pinned !== undefined) input.pinned = body.pinned === true;

  const lesson = await updateLesson(Number(id), input);
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lesson);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = await deleteLesson(Number(id));
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
