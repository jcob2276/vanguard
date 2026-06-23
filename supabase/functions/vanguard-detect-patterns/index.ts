import { createServiceClient } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { getWarsawDateString } from "../_shared/time.ts";

const supabase = createServiceClient();

interface DetectorResult {
  signature: string;
  pattern_type: string;
  description: string;
  evidence: Record<string, unknown>;
  first_seen: string;
  last_seen: string;
  occurrence_count: number;
  avg_impact: number | null;
  confidence: number;
  status: string;
}

// ============================================================
// S1: Recurring Blocker → Friction correlation
// ============================================================
async function detectRecurringBlockers(userId: string): Promise<DetectorResult[]> {
  // Get last 90 days of p2_parsed blocker_candidates
  const { data: recs } = await supabase
    .from("daily_reconciliations")
    .select("date, p2_parsed")
    .eq("user_id", userId)
    .not("p2_parsed", "is", null)
    .gte("date", offsetDate(getWarsawDateString(), -90))
    .order("date", { ascending: true });

  if (!recs || recs.length < 5) return [];

  // Extract blockers per day
  const blockerDays: { date: string; blockers: string[] }[] = [];
  for (const rec of recs) {
    const p2 = rec.p2_parsed as Record<string, unknown> | null;
    if (!p2) continue;
    const raw = p2.blocker_candidates;
    let blockers: string[] = [];
    if (Array.isArray(raw)) {
      blockers = raw.map((b: unknown) => String(b).toLowerCase().trim()).filter(Boolean);
    } else if (typeof raw === "string" && raw.trim()) {
      blockers = [raw.toLowerCase().trim()];
    }
    if (blockers.length > 0) {
      blockerDays.push({ date: rec.date, blockers });
    }
  }

  if (blockerDays.length < 5) return [];

  // Count blocker frequency
  const blockerCount: Record<string, number> = {};
  for (const { blockers } of blockerDays) {
    for (const b of blockers) {
      const key = normalizeBlocker(b);
      blockerCount[key] = (blockerCount[key] ?? 0) + 1;
    }
  }

  // Get friction events
  const { data: frictions } = await supabase
    .from("friction_events")
    .select("id, friction_type, created_at, event_kind")
    .eq("user_id", userId)
    .eq("event_kind", "friction_event")
    .gte("created_at", offsetDate(getWarsawDateString(), -97) + "T00:00:00Z");

  const results: DetectorResult[] = [];

  for (const [blocker, count] of Object.entries(blockerCount)) {
    if (count < 6) continue;

    // Find days when this blocker appeared
    const daysWithBlocker = blockerDays
      .filter(d => d.blockers.some(b => normalizeBlocker(b) === blocker))
      .map(d => d.date);

    // Count friction events 1-7 days after each blocker day
    let frictionHits = 0;
    for (const day of daysWithBlocker) {
      const windowStart = offsetDate(day, 1);
      const windowEnd = offsetDate(day, 7);
      const hit = (frictions ?? []).some(f => {
        const fDate = f.created_at.slice(0, 10);
        return fDate >= windowStart && fDate <= windowEnd;
      });
      if (hit) frictionHits++;
    }

    const strength = frictionHits / daysWithBlocker.length;
    if (strength < 0.45 || daysWithBlocker.length < 6) continue;

    const lastDay = daysWithBlocker[daysWithBlocker.length - 1];
    const firstDay = daysWithBlocker[0];
    const confidence = Math.min(0.95, 0.4 + strength * 0.4 + Math.min(count, 20) / 60);

    results.push({
      signature: `blocker:${blocker.slice(0, 40)}`,
      pattern_type: "recurring_blocker",
      description: `Kiedy nazywasz "${blocker}" jako blocker, w ${Math.round(strength * 100)}% przypadków (${frictionHits}/${daysWithBlocker.length}) w ciągu 7 dni pojawia się friction (N=${count}, ostatnie 90 dni)`,
      evidence: {
        n_days: count,
        strength,
        blocker_normalized: blocker,
        friction_hit_count: frictionHits,
        days_with_blocker: daysWithBlocker.length,
        examples: daysWithBlocker.slice(-3),
      },
      first_seen: firstDay,
      last_seen: lastDay,
      occurrence_count: count,
      avg_impact: null,
      confidence,
      status: confidence >= 0.65 && count >= 8 ? "visible" : "hypothesis",
    });
  }

  return results.slice(0, 5);
}

// ============================================================
// S2: Morning Protocol Impact → execution_score next day
// ============================================================
async function detectMorningProtocolImpact(userId: string): Promise<DetectorResult[]> {
  const { data: recs } = await supabase
    .from("daily_reconciliations")
    .select("date, operational_facts")
    .eq("user_id", userId)
    .not("operational_facts", "is", null)
    .gte("date", offsetDate(getWarsawDateString(), -90))
    .order("date", { ascending: true });

  if (!recs || recs.length < 8) return [];

  const { data: aggs } = await supabase
    .from("vanguard_daily_aggregates")
    .select("date, execution_score")
    .eq("user_id", userId)
    .not("execution_score", "is", null)
    .gte("date", offsetDate(getWarsawDateString(), -90))
    .order("date", { ascending: true });

  if (!aggs || aggs.length < 8) return [];

  const aggByDate: Record<string, number> = {};
  for (const a of aggs) aggByDate[a.date] = a.execution_score;

  const phoneFirstScores: number[] = [];
  const noPhoneScores: number[] = [];
  const first90BrokenScores: number[] = [];
  const first90ProtectedScores: number[] = [];

  for (const rec of recs) {
    const facts = rec.operational_facts as Record<string, unknown> | null;
    if (!facts) continue;
    const nextDay = offsetDate(rec.date, 1);
    const nextScore = aggByDate[nextDay];
    if (nextScore == null) continue;

    if (facts.phone_first === true) phoneFirstScores.push(nextScore);
    else if (facts.phone_first === false) noPhoneScores.push(nextScore);

    if (facts.first_90_protected === false) first90BrokenScores.push(nextScore);
    else if (facts.first_90_protected === true) first90ProtectedScores.push(nextScore);
  }

  const results: DetectorResult[] = [];

  // phone_first pattern
  if (phoneFirstScores.length >= 6 && noPhoneScores.length >= 6) {
    const avgPhone = avg(phoneFirstScores);
    const avgNoPhone = avg(noPhoneScores);
    const delta = avgNoPhone - avgPhone;
    if (Math.abs(delta) >= 0.1) {
      const n = phoneFirstScores.length + noPhoneScores.length;
      const confidence = Math.min(0.92, 0.5 + Math.abs(delta) * 1.5 + Math.min(n, 30) / 100);
      results.push({
        signature: "phone_first→execution_delta",
        pattern_type: "morning_protocol_impact",
        description: `Dni po phone_first mają średnio o ${delta.toFixed(2)} niższy execution_score niż dni bez (${avgPhone.toFixed(2)} vs ${avgNoPhone.toFixed(2)}, N=${n})`,
        evidence: {
          n_days: n,
          strength: Math.abs(delta),
          avg_execution_phone_first: avgPhone,
          avg_execution_no_phone: avgNoPhone,
          delta,
          n_phone_first: phoneFirstScores.length,
          n_no_phone: noPhoneScores.length,
        },
        first_seen: recs[0].date,
        last_seen: recs[recs.length - 1].date,
        occurrence_count: n,
        avg_impact: delta,
        confidence,
        status: confidence >= 0.65 ? "visible" : "hypothesis",
      });
    }
  }

  // first_90_protected pattern
  if (first90BrokenScores.length >= 5 && first90ProtectedScores.length >= 5) {
    const avgBroken = avg(first90BrokenScores);
    const avgProtected = avg(first90ProtectedScores);
    const delta = avgProtected - avgBroken;
    if (Math.abs(delta) >= 0.1) {
      const n = first90BrokenScores.length + first90ProtectedScores.length;
      const confidence = Math.min(0.90, 0.5 + Math.abs(delta) * 1.2 + Math.min(n, 30) / 100);
      results.push({
        signature: "first_90_protected→execution_delta",
        pattern_type: "morning_protocol_impact",
        description: `Kiedy first_90 jest chronione, execution_score następnego dnia jest średnio o ${delta.toFixed(2)} wyższy niż po przerwaniu (${avgProtected.toFixed(2)} vs ${avgBroken.toFixed(2)}, N=${n})`,
        evidence: {
          n_days: n,
          strength: Math.abs(delta),
          avg_execution_protected: avgProtected,
          avg_execution_broken: avgBroken,
          delta,
          n_protected: first90ProtectedScores.length,
          n_broken: first90BrokenScores.length,
        },
        first_seen: recs[0].date,
        last_seen: recs[recs.length - 1].date,
        occurrence_count: n,
        avg_impact: delta,
        confidence,
        status: confidence >= 0.65 ? "visible" : "hypothesis",
      });
    }
  }

  return results;
}

// ============================================================
// S3: Sleep bins → dominant friction_type next day
// ============================================================
async function detectSleepFrictionCorrelation(userId: string): Promise<DetectorResult[]> {
  const { data: aggs } = await supabase
    .from("vanguard_daily_aggregates")
    .select("date, total_sleep")
    .eq("user_id", userId)
    .not("total_sleep", "is", null)
    .gte("date", offsetDate(getWarsawDateString(), -90));

  if (!aggs || aggs.length < 10) return [];

  const { data: frictions } = await supabase
    .from("friction_events")
    .select("friction_type, created_at")
    .eq("user_id", userId)
    .eq("event_kind", "friction_event")
    .not("friction_type", "is", null)
    .gte("created_at", offsetDate(getWarsawDateString(), -91) + "T00:00:00Z");

  if (!frictions || frictions.length < 5) return [];

  const frictionByDate: Record<string, string[]> = {};
  for (const f of frictions) {
    const d = f.created_at.slice(0, 10);
    (frictionByDate[d] ??= []).push(f.friction_type);
  }

  // Bin sleep: low(<6h), mid(6-7h), high(>7h)
  const bins: Record<string, { frictions: string[] }> = {
    "low": { frictions: [] },
    "mid": { frictions: [] },
    "high": { frictions: [] },
  };

  for (const agg of aggs) {
    const sleep = agg.total_sleep;
    const nextDay = offsetDate(agg.date, 1);
    const nextFrictions = frictionByDate[nextDay] ?? [];
    if (nextFrictions.length === 0) continue;

    const bin = sleep < 6 ? "low" : sleep <= 7 ? "mid" : "high";
    bins[bin].frictions.push(...nextFrictions);
  }

  const results: DetectorResult[] = [];
  const lowBin = bins["low"];

  if (lowBin.frictions.length >= 8) {
    const topFriction = topValue(lowBin.frictions);
    const topCount = lowBin.frictions.filter(f => f === topFriction).length;
    const pct = topCount / lowBin.frictions.length;

    if (pct >= 0.35) {
      const n = aggs.filter(a => a.total_sleep < 6).length;
      const confidence = Math.min(0.88, 0.45 + pct * 0.6 + Math.min(n, 20) / 80);
      results.push({
        signature: `sleep<6h→${topFriction}`,
        pattern_type: "sleep_friction_correlation",
        description: `Po snach <6h następnego dnia pojawia się głównie friction:${topFriction} (${Math.round(pct * 100)}% przypadków, N=${n})`,
        evidence: {
          n_days: n,
          strength: pct,
          sleep_bin: "low",
          sleep_threshold: 6,
          top_friction_type: topFriction,
          top_friction_pct: pct,
          all_frictions_low: lowBin.frictions,
        },
        first_seen: offsetDate(getWarsawDateString(), -90),
        last_seen: getWarsawDateString(),
        occurrence_count: n,
        avg_impact: null,
        confidence,
        status: confidence >= 0.65 && n >= 8 ? "visible" : "hypothesis",
      });
    }
  }

  return results;
}

// ============================================================
// S4: Plan Adherence
// ============================================================
async function detectPlanAdherence(userId: string): Promise<DetectorResult[]> {
  const { data: recs } = await supabase
    .from("daily_reconciliations")
    .select("date, planning_summary, p2_parsed")
    .eq("user_id", userId)
    .not("planning_summary", "is", null)
    .not("p2_parsed", "is", null)
    .gte("date", offsetDate(getWarsawDateString(), -60))
    .order("date", { ascending: true });

  if (!recs || recs.length < 7) return [];

  let adherentCount = 0;
  let totalWithPlan = 0;
  const examples: string[] = [];

  for (const rec of recs) {
    const plan = rec.planning_summary as Record<string, unknown> | null;
    const p2 = rec.p2_parsed as Record<string, unknown> | null;
    if (!plan || !p2) continue;

    const artifact = String(plan.production_artifact ?? "").toLowerCase().trim();
    const tension = String(plan.tension_action ?? "").toLowerCase().trim();
    if (!artifact || artifact.length < 3) continue;

    totalWithPlan++;
    const p2Text = [
      String(p2.biggest_cost ?? ""),
      String(p2.best_move ?? ""),
      String(p2.correction ?? ""),
    ].join(" ").toLowerCase();

    // Simple heuristic: artifact keywords present in p2
    const artifactWords = artifact.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
    const tensionWords = tension.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
    const artifactHit = artifactWords.some(w => p2Text.includes(w));
    const tensionHit = tensionWords.some(w => p2Text.includes(w));

    if (artifactHit || tensionHit) {
      adherentCount++;
      examples.push(rec.date);
    }
  }

  if (totalWithPlan < 7) return [];

  const adherenceRate = adherentCount / totalWithPlan;
  const confidence = Math.min(0.85, 0.45 + (0.5 - Math.abs(adherenceRate - 0.5)) + Math.min(totalWithPlan, 30) / 100);

  return [{
    signature: "plan_vs_reality_adherence",
    pattern_type: "plan_adherence",
    description: `W ${Math.round(adherenceRate * 100)}% planów (${adherentCount}/${totalWithPlan}) wieczorny p2_parsed pokazuje realizację deklarowanego artefaktu/tension (N=${totalWithPlan}, ostatnie 60 dni)`,
    evidence: {
      n_days: totalWithPlan,
      strength: adherenceRate,
      adherent_count: adherentCount,
      total_with_plan: totalWithPlan,
      adherence_rate: adherenceRate,
      adherent_examples: examples.slice(-5),
    },
    first_seen: recs[0].date,
    last_seen: recs[recs.length - 1].date,
    occurrence_count: totalWithPlan,
    avg_impact: null,
    confidence,
    status: confidence >= 0.60 && totalWithPlan >= 8 ? "visible" : "hypothesis",
  }];
}

// ============================================================
// Upsert patterns to DB
// ============================================================
async function upsertPattern(userId: string, pattern: DetectorResult) {
  const { data: existing } = await supabase
    .from("vanguard_behavioral_patterns")
    .select("id, status, occurrence_count")
    .eq("user_id", userId)
    .eq("signature", pattern.signature)
    .maybeSingle();

  if (existing) {
    // Don't override user_confirmed/user_rejected status
    const keepStatus = existing.status === "user_confirmed" || existing.status === "user_rejected";
    const { error } = await supabase
      .from("vanguard_behavioral_patterns")
      .update({
        description: pattern.description,
        evidence: pattern.evidence,
        last_seen: pattern.last_seen,
        occurrence_count: pattern.occurrence_count,
        avg_impact: pattern.avg_impact,
        confidence: pattern.confidence,
        status: keepStatus ? existing.status : pattern.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) console.error("[detect-patterns] update error:", error.message);
    return "updated";
  } else {
    const { error } = await supabase
      .from("vanguard_behavioral_patterns")
      .insert({
        user_id: userId,
        pattern_type: pattern.pattern_type,
        signature: pattern.signature,
        description: pattern.description,
        evidence: pattern.evidence,
        first_seen: pattern.first_seen,
        last_seen: pattern.last_seen,
        occurrence_count: pattern.occurrence_count,
        avg_impact: pattern.avg_impact,
        confidence: pattern.confidence,
        status: pattern.status,
      });
    if (error) console.error("[detect-patterns] insert error:", error.message);
    return "inserted";
  }
}

// ============================================================
// Helpers
// ============================================================
function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function topValue(arr: string[]): string {
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function normalizeBlocker(b: string): string {
  return b.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, "_").slice(0, 40);
}

// ============================================================
// Main handler
// ============================================================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type" } });
  }

  try {
    let userId = getVanguardUserId();
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.user_id) userId = body.user_id;
    }

    console.log(`[detect-patterns] Running for user ${userId}`);

    const [s1, s2, s3, s4] = await Promise.all([
      detectRecurringBlockers(userId),
      detectMorningProtocolImpact(userId),
      detectSleepFrictionCorrelation(userId),
      detectPlanAdherence(userId),
    ]);

    const all = [...s1, ...s2, ...s3, ...s4];
    console.log(`[detect-patterns] Found ${all.length} patterns total`);

    let inserted = 0, updated = 0;
    for (const p of all) {
      const result = await upsertPattern(userId, p);
      if (result === "inserted") inserted++;
      else updated++;
    }

    return new Response(JSON.stringify({
      patterns_found: all.length,
      patterns_inserted: inserted,
      patterns_updated: updated,
      signatures: all.map(p => p.signature),
    }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[detect-patterns] error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
