/**
 * streamRepo.ts — Typed queries for vanguard_stream table.
 *
 * Thin data-access layer. Business logic stays in calling functions.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../database.types.ts";

type Client = SupabaseClient<Database>;
type StreamRow = Database["public"]["Tables"]["vanguard_stream"]["Row"];
// Generated type says `embedding: string | null` (pgvector is a USER-DEFINED column, poorly
// inferred by the type generator) but every caller actually builds it as a raw number[] from
// OpenAI embeddings — widen just that field instead of casting at every call site.
type StreamInsert =
  & Omit<Database["public"]["Tables"]["vanguard_stream"]["Insert"], "embedding">
  & { embedding?: number[] | number[][] | string | null };

export async function getStreamByUser(
  db: Client,
  userId: string,
  opts?: { from?: string; to?: string; limit?: number },
): Promise<StreamRow[]> {
  let q = db
    .from("vanguard_stream")
    .select("*")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false });

  if (opts?.from) q = q.gte("timestamp", opts.from);
  if (opts?.to) q = q.lte("timestamp", opts.to);
  if (opts?.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function insertStreamRecord(
  db: Client,
  record: StreamInsert,
): Promise<StreamRow> {
  const { data, error } = await db
    .from("vanguard_stream")
    .insert(record as Database["public"]["Tables"]["vanguard_stream"]["Insert"])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getStreamBySource(
  db: Client,
  userId: string,
  source: string,
  opts?: { from?: string; limit?: number },
): Promise<StreamRow[]> {
  // Always selects "*" — Supabase JS cannot type a dynamic column-list string
  // (falls back to an untyped error shape), so callers pick fields off the
  // full typed row instead of requesting a partial column set.
  let q = db
    .from("vanguard_stream")
    .select("*")
    .eq("user_id", userId)
    .eq("source", source)
    .order("created_at", { ascending: false });

  if (opts?.from) q = q.gte("created_at", opts.from);
  if (opts?.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getStreamByTelegramMessageId(
  db: Client,
  messageId: number | string,
): Promise<StreamRow | null> {
  const { data, error } = await db
    .from("vanguard_stream")
    .select("*")
    .eq("metadata->>telegram_message_id", messageId.toString())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStreamByClassification(
  db: Client,
  userId: string,
  classification: string,
  opts?: { limit?: number },
): Promise<StreamRow[]> {
  let q = db
    .from("vanguard_stream")
    .select("*")
    .eq("user_id", userId)
    .eq("classification", classification)
    .order("timestamp", { ascending: false });

  if (opts?.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Content+timestamp only, for RAG context windows (Oracle prompt building). */
export async function getStreamContentInRange(
  db: Client,
  userId: string,
  opts: { gte?: string; lt?: string; limit?: number },
): Promise<Pick<StreamRow, "content" | "created_at">[]> {
  let q = db
    .from("vanguard_stream")
    .select("content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (opts.gte) q = q.gte("created_at", opts.gte);
  if (opts.lt) q = q.lt("created_at", opts.lt);
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Bi-temporal soft-close (sets valid_until) — used by closure-proposal approval flow. */
export async function closeStreamRecords(
  db: Client,
  ids: string[],
  validUntil: string,
): Promise<void> {
  const { error } = await db
    .from("vanguard_stream")
    .update({ valid_until: validUntil })
    .in("id", ids);
  if (error) throw error;
}

export async function getStreamForWeeklySynthesis(
  db: Client,
  userId: string,
  since: string,
  limit = 35,
): Promise<Pick<StreamRow, "content" | "created_at" | "category">[]> {
  const { data, error } = await db
    .from("vanguard_stream")
    .select("content, created_at, category")
    .eq("user_id", userId)
    .gte("created_at", since)
    .not("source", "eq", "system")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getRecentAlertRecord(
  db: Client,
  userId: string,
  since: string,
): Promise<StreamRow | null> {
  const { data, error } = await db
    .from("vanguard_stream")
    .select("*")
    .eq("user_id", userId)
    .eq("source", "analyst_alert")
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStreamForDailyReconciliation(
  db: Client,
  userId: string,
  from: string,
  to: string,
  limit = 80,
): Promise<Pick<StreamRow, "id" | "content" | "created_at" | "metadata">[]> {
  const { data, error } = await db
    .from("vanguard_stream")
    .select("id, content, created_at, metadata")
    .eq("user_id", userId)
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function updateStreamClassification(
  db: Client,
  id: string,
  updates: {
    importance_score?: number | null;
    category?: string | null;
    tags?: string[] | null;
    // situation_fingerprint is pgvector, same type-generator gap as StreamInsert.embedding above.
    situation_fingerprint?: number[] | string | null;
    classification?: string | null;
    valid_from?: string | null;
    valid_until?: string | null;
  },
): Promise<void> {
  const { error } = await db
    .from("vanguard_stream")
    .update(updates as Database["public"]["Tables"]["vanguard_stream"]["Update"])
    .eq("id", id);
  if (error) throw error;
}
