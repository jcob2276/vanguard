/**
 * streamRepo.ts — Typed queries for vanguard_stream table.
 *
 * Thin data-access layer. Business logic stays in calling functions.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../database.types.ts";

type StreamRow = Database["public"]["Tables"]["vanguard_stream"]["Row"];
type StreamInsert = Database["public"]["Tables"]["vanguard_stream"]["Insert"];

export async function getStreamByUser(
  db: SupabaseClient,
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
  db: SupabaseClient,
  record: StreamInsert,
): Promise<StreamRow> {
  const { data, error } = await db
    .from("vanguard_stream")
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getStreamByClassification(
  db: SupabaseClient,
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
