import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Deprecate conflicting active facts when a new high-confidence link arrives. */
export async function deprecateSupersededLinks(
  supabase: SupabaseClient,
  userId: string,
  source: string,
  relation: string,
  newTarget: string,
  newConfidence: number,
  newEpisodeId: string | null,
): Promise<number> {
  if (newConfidence < 0.80) return 0;
  if (!source || !relation || !newTarget) return 0;

  try {
    const { data, error } = await supabase.rpc("deprecate_superseded_facts", {
      p_user_id: userId,
      p_source: source,
      p_relation: relation,
      p_new_target: newTarget,
      p_new_confidence: newConfidence,
      p_new_episode_id: newEpisodeId ?? null,
    });
    if (error) {
      console.error("[deprecateSupersededLinks] error:", error);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (err) {
    console.error("[deprecateSupersededLinks] exception:", err);
    return 0;
  }
}
