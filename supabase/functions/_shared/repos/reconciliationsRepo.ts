/**
 * reconciliationsRepo.ts — Typed queries for daily_reconciliations table.
 *
 * Thin data-access layer. Business logic stays in calling functions.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../database.types.ts";

type ReconciliationRow = Database["public"]["Tables"]["daily_reconciliations"]["Row"];
type ReconciliationInsert = Database["public"]["Tables"]["daily_reconciliations"]["Insert"];
type ReconciliationUpdate = Database["public"]["Tables"]["daily_reconciliations"]["Update"];

export async function getReconciliationByDate(
  db: SupabaseClient,
  userId: string,
  date: string,
): Promise<ReconciliationRow | null> {
  const { data, error } = await db
    .from("daily_reconciliations")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getReconciliationsByRange(
  db: SupabaseClient,
  userId: string,
  opts: { from: string; to: string },
): Promise<ReconciliationRow[]> {
  const { data, error } = await db
    .from("daily_reconciliations")
    .select("*")
    .eq("user_id", userId)
    .gte("date", opts.from)
    .lte("date", opts.to)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertReconciliation(
  db: SupabaseClient,
  record: ReconciliationInsert,
): Promise<ReconciliationRow> {
  const { data, error } = await db
    .from("daily_reconciliations")
    .upsert(record, { onConflict: "user_id,date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateReconciliation(
  db: SupabaseClient,
  userId: string,
  date: string,
  updates: ReconciliationUpdate,
): Promise<ReconciliationRow> {
  const { data, error } = await db
    .from("daily_reconciliations")
    .update(updates)
    .eq("user_id", userId)
    .eq("date", date)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLatestReconciliation(
  db: SupabaseClient,
  userId: string,
): Promise<ReconciliationRow | null> {
  const { data, error } = await db
    .from("daily_reconciliations")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
