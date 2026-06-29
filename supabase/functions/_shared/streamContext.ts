import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeExecute } from "./supabase.ts";
import { getStreamCutoffs } from "./time.ts";

export type StreamRow = {
  content: string;
  category?: string | null;
  created_at: string;
};

/** Oracle RAG: 72h priority + optional 3–21d window when pattern query. */
export async function fetchOracleStreamSlices(
  supabase: SupabaseClient,
  userId: string,
  options: { includePatternWindow?: boolean; patternLimit?: number } = {},
): Promise<{ current: StreamRow[]; recent: StreamRow[] }> {
  const { cut24h, cut72h, cut21d } = getStreamCutoffs();
  const patternLimit = options.patternLimit ?? (options.includePatternWindow ? 15 : 5);

  const [current, recent] = await Promise.all([
    safeExecute(
      supabase
        .from("vanguard_stream")
        .select("content, created_at")
        .eq("user_id", userId)
        .gte("created_at", cut24h)
        .order("created_at", { ascending: false })
        .limit(15),
    ),
    options.includePatternWindow
      ? safeExecute(
          supabase
            .from("vanguard_stream")
            .select("content, created_at")
            .eq("user_id", userId)
            .lt("created_at", cut72h)
            .gte("created_at", cut21d)
            .order("created_at", { ascending: false })
            .limit(patternLimit),
        )
      : Promise.resolve([] as StreamRow[]),
  ]);

  return { current: current || [], recent: recent || [] };
}

export function formatOracleStreamBlock(current: StreamRow[], recent: StreamRow[]): string {
  let block = "";
  if (current.length > 0) {
    const rows = [...current].reverse();
    block += "\n\n[TERAŹNIEJSZOŚĆ (ostatnie 72h) — PRIORYTET ABSOLUTNY]:\n" +
      rows.map((s) => `[${s.created_at}] ${s.content}`).join("\n");
  }
  if (recent.length > 0) {
    const rows = [...recent].reverse();
    block += "\n\n[KONTEKST OSTATNICH 3–21 DNI]:\n" +
      rows.map((s) => `[${s.created_at}] ${s.content}`).join("\n");
  }
  return block;
}
