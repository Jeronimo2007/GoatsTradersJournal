import "server-only";
import { getActiveAccountId } from "./accountsStore";
import { BUCKETS, requireUser } from "./supabase/server";
import {
  downloadBytes,
  objectPath,
  removeObject,
  uploadBytes,
} from "./supabase/storage";

export interface TradeDocument {
  html: string;
  hasPdf: boolean;
  updatedAt: string | null;
  pdfUpdatedAt: string | null;
}

export async function getDocument(tradeId: number): Promise<TradeDocument> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("trade_documents")
    .select("html, pdf_path, updated_at, pdf_updated_at")
    .eq("trade_id", tradeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    return { html: "", hasPdf: false, updatedAt: null, pdfUpdatedAt: null };
  }

  return {
    html: data.html ?? "",
    hasPdf: !!data.pdf_path,
    updatedAt: data.updated_at ?? null,
    pdfUpdatedAt: data.pdf_updated_at ?? null,
  };
}

export async function saveDocument(
  tradeId: number,
  html: string
): Promise<TradeDocument> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("trade_documents")
    .select("pdf_path, pdf_updated_at")
    .eq("trade_id", tradeId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("trade_documents").upsert({
    trade_id: tradeId,
    user_id: user.id,
    account_id: accountId,
    html,
    updated_at: now,
    pdf_path: existing?.pdf_path ?? null,
    pdf_updated_at: existing?.pdf_updated_at ?? null,
  });

  if (error) throw new Error(`Failed to save document: ${error.message}`);
  return getDocument(tradeId);
}

export async function savePdf(tradeId: number, data: Buffer): Promise<void> {
  const { supabase, user } = await requireUser();
  const accountId = await getActiveAccountId();
  const path = objectPath(user.id, accountId, `${tradeId}.pdf`);
  const now = new Date().toISOString();

  await uploadBytes(supabase, BUCKETS.tradeDocuments, path, data, "application/pdf");

  const { data: existing } = await supabase
    .from("trade_documents")
    .select("html, updated_at")
    .eq("trade_id", tradeId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("trade_documents").upsert({
    trade_id: tradeId,
    user_id: user.id,
    account_id: accountId,
    html: existing?.html ?? "",
    updated_at: existing?.updated_at ?? now,
    pdf_path: path,
    pdf_updated_at: now,
  });

  if (error) throw new Error(`Failed to save PDF metadata: ${error.message}`);
}

export async function readPdf(tradeId: number): Promise<Buffer | null> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("trade_documents")
    .select("pdf_path")
    .eq("trade_id", tradeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data?.pdf_path) return null;
  const file = await downloadBytes(supabase, BUCKETS.tradeDocuments, data.pdf_path);
  return file?.data ?? null;
}

export async function deleteDocument(tradeId: number): Promise<void> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("trade_documents")
    .select("pdf_path")
    .eq("trade_id", tradeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (data?.pdf_path) {
    await removeObject(supabase, BUCKETS.tradeDocuments, data.pdf_path);
  }

  await supabase
    .from("trade_documents")
    .delete()
    .eq("trade_id", tradeId)
    .eq("user_id", user.id);
}
