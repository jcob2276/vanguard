/**
 * aggregatesRepo.ts — Typed queries for vanguard_daily_aggregates table.
 *
 * Thin data-access layer. Business logic stays in calling functions.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../database.types.ts";

type Client = SupabaseClient<Database>;
type AggregateRow = Database["public"]["Tables"]["vanguard_daily_aggregates"]["Row"];
type AggregateInsert = Database["public"]["Tables"]["vanguard_daily_aggregates"]["Insert"];
type AggregateUpdate = Database["public"]["Tables"]["vanguard_daily_aggregates"]["Update"];

export async function getAggregateByDate(
  db: Client,
  userId: string,
  date: string,
): Promise<AggregateRow | null> {
  const { data, error } = await db
    .from("vanguard_daily_aggregates")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAggregatesByRange(
  db: Client,
  userId: string,
  opts: { from: string; to: string },
): Promise<AggregateRow[]> {
  const { data, error } = await db
    .from("vanguard_daily_aggregates")
    .select("*")
    .eq("user_id", userId)
    .gte("date", opts.from)
    .lte("date", opts.to)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertAggregate(
  db: Client,
  record: AggregateInsert,
): Promise<AggregateRow> {
  const { data, error } = await db
    .from("vanguard_daily_aggregates")
    .upsert(record, { onConflict: "user_id,date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAggregate(
  db: Client,
  userId: string,
  date: string,
  updates: AggregateUpdate,
): Promise<AggregateRow> {
  const { data, error } = await db
    .from("vanguard_daily_aggregates")
    .update(updates)
    .eq("user_id", userId)
    .eq("date", date)
    .select()
    .single();
  if (error) throw error;
  return data;
}
