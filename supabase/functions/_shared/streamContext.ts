import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeExecute } from "./supabase.ts";
import { getStreamCutoffs } from "./time.ts";

export type StreamRow = {
  content: string;
  category?: string | null;
  created_at: string;
};

export type BriefingStreamLayers = {
  stream24h: StreamRow[];
  stream72h: StreamRow[];
  streamPattern: StreamRow[];
};

/** Current-first stream slices for briefing / synthesis-style prompts. */
export async function fetchBriefingStreamLayers(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<BriefingStreamLayers> {
  const { cut24h, cut72h, cut21d } = getStreamCutoffs(now);

  const stream24h = await safeExecute(
    supabase
      .from("vanguard_stream")
      .select("content, category, created_at")
      .eq("user_id", userId)
      .gte("created_at", cut24h)
      .order("created_at", { ascending: true })
      .limit(25),
  );

  const stream72h = await safeExecute(
    supabase
      .from("vanguard_stream")
      .select("content, category, created_at")
      .eq("user_id", userId)
      .gte("created_at", cut72h)
      .lt("created_at", cut24h)
      .order("created_at", { ascending: false })
      .limit(stream24h.length >= 5 ? 3 : 12),
  );

  const streamPattern = await safeExecute(
    supabase
      .from("vanguard_stream")
      .select("content, category, created_at")
      .eq("user_id", userId)
      .gte("created_at", cut21d)
      .lt("created_at", cut72h)
      .order("created_at", { ascending: false })
      .limit(8),
  );

  return { stream24h: stream24h || [], stream72h: stream72h || [], streamPattern: streamPattern || [] };
}

export function formatBriefingStreamText(layers: BriefingStreamLayers): {
  stream24hText: string;
  stream72hText: string;
  streamPatternText: string;
} {
  const stream24hText = layers.stream24h.length > 0
    ? layers.stream24h.map((s) => `[${s.created_at}][${s.category}] ${s.content}`).join("\n")
    : "Brak wpisów z ostatnich 24h.";

  const stream72hText = layers.stream72h.length > 0
    ? "[24h–72h temu]:\n" + layers.stream72h.map((s) => `[${s.created_at}][${s.category}] ${s.content}`).join("\n")
    : "";

  const streamPatternText = layers.streamPattern.length > 0
    ? "[ARCHIWUM 72h–21d — tylko kontekst wzorca, nie aktualna prawda]:\n" +
      layers.streamPattern.map((s) => `[${s.created_at}][${s.category}] ${s.content}`).join("\n")
    : "";

  return { stream24hText, stream72hText, streamPatternText };
}

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
