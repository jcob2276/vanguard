import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "./database.types.ts";
import { getStreamCutoffs } from "./time.ts";
import { getStreamContentInRange } from "./repos/streamRepo.ts";

export type StreamRow = {
  content: string | null;
  category?: string | null;
  created_at: string | null;
};

/** Oracle RAG: 72h priority + optional 3–21d window when pattern query. */
export async function fetchOracleStreamSlices(
  supabase: SupabaseClient<Database>,
  userId: string,
  options: { includePatternWindow?: boolean; patternLimit?: number } = {},
): Promise<{ current: StreamRow[]; recent: StreamRow[] }> {
  const { cut24h, cut72h, cut21d } = getStreamCutoffs();
  const patternLimit = options.patternLimit ?? (options.includePatternWindow ? 15 : 5);

  const [current, recent] = await Promise.all([
    getStreamContentInRange(supabase, userId, { gte: cut24h, limit: 15 }).catch(() => []),
    options.includePatternWindow
      ? getStreamContentInRange(supabase, userId, { lt: cut72h, gte: cut21d, limit: patternLimit }).catch(() => [])
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
