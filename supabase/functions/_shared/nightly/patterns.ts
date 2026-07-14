import { EPISTEMIC_THRESHOLDS } from '@vanguard/domain';
import { getWarsawDateString } from '../time.ts';
import {
  detectRecurringBlockers,
  detectPlanAdherenceGaps,
  detectMorningProtocolImpact,
  detectSleepFrictionLink,
  detectEarlyWarningSignals,
  detectNarrativeBiometricMismatch,
  type PatternInsight,
} from '../vanguardPatterns.ts';

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
  const today = getWarsawDateString();
  const signature = `${insight.type}:${insight.title.toLowerCase().replace(/\s+/g, "_").substring(0, 80)}`;
  const visible =
    insight.type === "plan_adherence_gap"
      ? insight.confidence >= EPISTEMIC_THRESHOLDS.PATTERN_VISIBLE_MIN_CONFIDENCE
      : insight.confidence >= EPISTEMIC_THRESHOLDS.PATTERN_VISIBLE_MIN_CONFIDENCE &&
        insight.sampleSize >= EPISTEMIC_THRESHOLDS.PATTERN_VISIBLE_MIN_SAMPLE_SIZE;

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
    status: visible ? "visible" : "pending",
  };
}

async function upsertPattern(supabase: any, userId: string, pattern: DetectorResult): Promise<string> {
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
    if (error) {
      console.error("[detect-patterns] update error:", error.message);
      throw new Error(error.message);
    }
    return existing.id;
  }

  const { data, error } = await supabase.from("vanguard_behavioral_patterns").insert({
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
  }).select('id').single();
  if (error) {
    console.error("[detect-patterns] insert error:", error.message);
    throw new Error(error.message);
  }
  return data.id;
}

export const runDetectPatterns = async (
  supabase: any,
  userId: string
): Promise<{
  patterns_found: number;
  patterns_inserted: number;
  patterns_updated: number;
}> => {
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
  const today = getWarsawDateString(new Date());
  for (const p of all) {
    const patternId = await upsertPattern(supabase, userId, p);
    const { error: evErr } = await supabase.from("pattern_events").upsert({
       pattern_id: patternId,
       occurred_on: today
    }, { onConflict: "pattern_id,occurred_on" });
    if (evErr) console.warn("Failed to insert pattern_event", evErr.message);
    updated++;
  }

  return {
    patterns_found: all.length,
    patterns_inserted: inserted,
    patterns_updated: updated,
  };
}
