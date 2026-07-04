import { createServiceClient, corsHeadersFor, resolveUserScope } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { getWarsawDateString } from "../_shared/time.ts";
import {
  detectRecurringBlockers,
  detectPlanAdherenceGaps,
  detectMorningProtocolImpact,
  detectSleepFrictionLink,
  detectEarlyWarningSignals,
  detectNarrativeBiometricMismatch,
  type PatternInsight,
} from "../_shared/vanguardPatterns.ts";

const supabase = createServiceClient();

interface DetectorResult {
  signature: string;
  pattern_type: string;
  title: string;
  evidence_text: string;
  metadata: Record<string, unknown>;
  first_seen: string;
  last_seen: string;
  occurrence_count: number;
  confidence: number;
  status: string;
}

function insightToDetector(insight: PatternInsight): DetectorResult {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
  const signature = `${insight.type}:${insight.title.toLowerCase().replace(/\s+/g, "_").substring(0, 80)}`;
  const visible =
    insight.type === "plan_adherence_gap"
      ? insight.confidence >= 0.6
      : insight.confidence >= 0.6 && insight.sampleSize >= 3;

  return {
    signature,
    pattern_type: insight.type,
    title: insight.title,
    evidence_text: insight.evidenceText,
    metadata: { ...insight.metadata, sample_size: insight.sampleSize },
    first_seen: insight.lastSeenDate || today,
    last_seen: insight.lastSeenDate || today,
    occurrence_count: insight.sampleSize,
    confidence: insight.confidence,
    status: visible ? "visible" : "hypothesis",
  };
}

async function upsertPattern(userId: string, pattern: DetectorResult): Promise<"inserted" | "updated"> {
  const { data: existing } = await supabase
    .from("vanguard_behavioral_patterns")
    .select("id, status")
    .eq("user_id", userId)
    .eq("signature", pattern.signature)
    .maybeSingle();

  if (existing) {
    const keepStatus = existing.status === "user_confirmed" || existing.status === "user_rejected";
    const { error } = await supabase
      .from("vanguard_behavioral_patterns")
      .update({
        title: pattern.title,
        evidence_text: pattern.evidence_text,
        metadata: pattern.metadata,
        last_seen: pattern.last_seen,
        occurrence_count: pattern.occurrence_count,
        confidence: pattern.confidence,
        status: keepStatus ? existing.status : pattern.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) console.error("[detect-patterns] update error:", error.message);
    return "updated";
  }

  const { error } = await supabase.from("vanguard_behavioral_patterns").insert({
    user_id: userId,
    pattern_type: pattern.pattern_type,
    signature: pattern.signature,
    title: pattern.title,
    evidence_text: pattern.evidence_text,
    metadata: pattern.metadata,
    first_seen: pattern.first_seen,
    last_seen: pattern.last_seen,
    occurrence_count: pattern.occurrence_count,
    confidence: pattern.confidence,
    status: pattern.status,
  });
  if (error) console.error("[detect-patterns] insert error:", error.message);
  return "inserted";
}

Deno.serve(async (req: Request) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    let userId = getVanguardUserId();
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.user_id) {
        const scope = await resolveUserScope(req, body.user_id);
        userId = scope.userId ?? userId;
      }
    }

    console.log(`[detect-patterns] Running for user ${userId}`);

    const yesterday = getWarsawDateString(new Date(Date.now() - 86400000));

    const [s1, s2, s3, s4, s5, s6] = await Promise.all([
      detectRecurringBlockers(supabase, userId),
      detectMorningProtocolImpact(supabase, userId),
      detectSleepFrictionLink(supabase, userId),
      detectPlanAdherenceGaps(supabase, userId, yesterday),
      detectEarlyWarningSignals(supabase, userId),
      detectNarrativeBiometricMismatch(supabase, userId),
    ]);

    const all = [...s1, ...s2, ...s3, ...s4, ...s5, ...s6].map(insightToDetector);
    console.log(`[detect-patterns] Found ${all.length} patterns total`);

    let inserted = 0;
    let updated = 0;
    for (const p of all) {
      const result = await upsertPattern(userId, p);
      if (result === "inserted") inserted++;
      else updated++;
    }

    return new Response(
      JSON.stringify({
        patterns_found: all.length,
        patterns_inserted: inserted,
        patterns_updated: updated,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[detect-patterns] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
