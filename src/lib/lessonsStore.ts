import "server-only";
import type { Lesson, LessonInput } from "./types";
import { LESSON_MAX_LENGTH } from "./types";
import { requireUser } from "@/lib/supabase/server";

export function extractTags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const m of matches) {
    const tag = m.slice(1).toLowerCase();
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

interface LessonRow {
  id: number;
  text: string;
  tags: string[] | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

function rowToLesson(r: LessonRow): Lesson {
  return {
    id: Number(r.id),
    text: r.text ?? "",
    tags: Array.isArray(r.tags) ? r.tags.map(String) : extractTags(r.text ?? ""),
    pinned: !!r.pinned,
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
  };
}

function cleanText(text: string): string {
  return text.trim().slice(0, LESSON_MAX_LENGTH);
}

function sortLessons(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function getLessons(): Promise<Lesson[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to load lessons: ${error.message}`);
  return sortLessons(((data ?? []) as LessonRow[]).map(rowToLesson));
}

export async function getLesson(id: number): Promise<Lesson | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load lesson: ${error.message}`);
  return data ? rowToLesson(data as LessonRow) : null;
}

export async function createLesson(input: LessonInput): Promise<Lesson> {
  const { supabase, user } = await requireUser();
  const now = new Date().toISOString();
  const text = cleanText(input.text);
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      user_id: user.id,
      text,
      tags: extractTags(text),
      pinned: input.pinned === true,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create lesson: ${error?.message ?? "unknown"}`);
  }
  return rowToLesson(data as LessonRow);
}

export async function updateLesson(
  id: number,
  input: Partial<LessonInput>
): Promise<Lesson | null> {
  const { supabase, user } = await requireUser();
  const existing = await getLesson(id);
  if (!existing) return null;

  const text = input.text !== undefined ? cleanText(input.text) : existing.text;
  const { data, error } = await supabase
    .from("lessons")
    .update({
      text,
      tags: extractTags(text),
      pinned:
        input.pinned !== undefined ? input.pinned === true : existing.pinned,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update lesson: ${error.message}`);
  return data ? rowToLesson(data as LessonRow) : null;
}

export async function deleteLesson(id: number): Promise<boolean> {
  const { supabase, user } = await requireUser();
  const existing = await getLesson(id);
  if (!existing) return false;
  const { error } = await supabase
    .from("lessons")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to delete lesson: ${error.message}`);
  return true;
}
