import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKETS } from "./server";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function mimeFromExt(ext: string): string {
  const found = Object.entries(EXT_BY_MIME).find(
    ([, e]) => e === ext.toLowerCase()
  );
  return found?.[0] ?? "application/octet-stream";
}

export function extFromMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "png";
}

/** Parse a data URL into buffer + mime. Returns null if invalid. */
export function parseDataUrl(
  value: string
): { buffer: Buffer; mime: string; ext: string } | null {
  const match = value.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!match) return null;
  const mime = match[1];
  return {
    buffer: Buffer.from(match[2], "base64"),
    mime,
    ext: extFromMime(mime),
  };
}

/** Storage object path: {userId}/{accountId}/{filename} */
export function objectPath(
  userId: string,
  accountId: string,
  filename: string
): string {
  return `${userId}/${accountId}/${filename}`;
}

export async function uploadBytes(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, data, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function downloadBytes(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<{ data: Buffer; contentType: string } | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  const ext = path.split(".").pop() ?? "";
  return { data: buffer, contentType: mimeFromExt(ext) };
}

export async function removeObject(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<void> {
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}

export { BUCKETS, EXT_BY_MIME };
