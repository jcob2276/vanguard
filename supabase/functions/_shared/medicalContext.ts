type SupabaseClientLike = {
  from: (table: string) => any;
};

const PRIORITY_MARKERS = [
  "ferritin",
  "hemoglobin",
  "hematocrit",
  "rbc",
  "mcv",
  "glucose",
  "cholesterol_total",
  "ldl_cholesterol_calculated",
  "hdl_cholesterol",
  "triglycerides",
  "non_hdl_cholesterol",
  "magnesium_serum",
  "tsh",
  "testosterone_total",
  "vitamin_d_25oh",
];

function diffDays(date: string, today: string): number | null {
  const d = new Date(`${date}T00:00:00Z`).getTime();
  const t = new Date(`${today}T00:00:00Z`).getTime();
  if (!Number.isFinite(d) || !Number.isFinite(t)) return null;
  return Math.round((t - d) / 86400000);
}

function freshness(ageDays: number | null): "current" | "recent" | "stale" | "old" | "future_or_unknown" {
  if (ageDays == null || ageDays < 0) return "future_or_unknown";
  if (ageDays <= 90) return "current";
  if (ageDays <= 180) return "recent";
  if (ageDays <= 365) return "stale";
  return "old";
}

function markerPriority(markerKey: string): number {
  const idx = PRIORITY_MARKERS.indexOf(markerKey);
  return idx === -1 ? PRIORITY_MARKERS.length + 1 : idx;
}

type TrendInfo = {
  direction: "rising" | "falling" | "stable";
  delta_pct: number;
  prior_date: string;
  prior_value: number;
};

function computeTrend(latest: number, priorDate: string, priorValue: number): TrendInfo {
  const delta_pct = priorValue !== 0 ? Math.round(((latest - priorValue) / priorValue) * 1000) / 10 : 0;
  const direction: TrendInfo["direction"] =
    Math.abs(delta_pct) < 5 ? "stable" : delta_pct > 0 ? "rising" : "falling";
  return { direction, delta_pct, prior_date: priorDate, prior_value: priorValue };
}

export async function fetchMedicalContext(
  supabase: SupabaseClientLike,
  userId: string,
  today: string,
) {
  const [labRes, bodyCompRes, docRes] = await Promise.all([
    supabase
      .from("medical_lab_results")
      .select("result_date, marker_key, marker_name, category, value, unit, ref_text, flag, source_name, provider, notes")
      .eq("user_id", userId)
      .order("result_date", { ascending: false })
      .limit(120),
    supabase
      .from("body_composition_measurements")
      .select("measured_at, source, method, reliability, weight_kg, body_fat_pct, fat_mass_kg, muscle_mass_kg, visceral_fat_rating, notes")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(5),
    supabase
      .from("medical_documents")
      .select("document_date, document_type, source_name, provider, clinical_validity, summary")
      .eq("user_id", userId)
      .order("document_date", { ascending: false })
      .limit(20),
  ]);

  if (labRes.error) throw new Error(`[medicalContext] medical_lab_results: ${labRes.error.message}`);
  if (bodyCompRes.error) throw new Error(`[medicalContext] body_composition_measurements: ${bodyCompRes.error.message}`);
  if (docRes.error) throw new Error(`[medicalContext] medical_documents: ${docRes.error.message}`);

  // labRes.data is ordered by result_date desc, so the first 2 rows seen per
  // marker are [latest, prior] — enough for a direction-of-change trend without
  // needing the daily-cadence data density a full SPC baseline would require.
  const rowsByMarker = new Map<string, any[]>();
  for (const row of labRes.data || []) {
    const arr = rowsByMarker.get(row.marker_key);
    if (arr) { if (arr.length < 2) arr.push(row); }
    else rowsByMarker.set(row.marker_key, [row]);
  }

  const latest_labs = Array.from(rowsByMarker.values())
    .map(([row, prior]) => {
      const age_days = diffDays(row.result_date, today);
      const trend = prior ? computeTrend(Number(row.value), prior.result_date, Number(prior.value)) : null;
      return {
        date: row.result_date,
        age_days,
        freshness: freshness(age_days),
        marker_key: row.marker_key,
        marker_name: row.marker_name,
        category: row.category,
        value: Number(row.value),
        unit: row.unit,
        ref_text: row.ref_text,
        flag: row.flag,
        source: row.source_name,
        provider: row.provider,
        notes: row.notes,
        trend,
      };
    })
    .sort((a, b) => markerPriority(a.marker_key) - markerPriority(b.marker_key))
    .slice(0, 24);

  const body_composition = (bodyCompRes.data || []).map((row: any) => {
    const date = String(row.measured_at || "").slice(0, 10);
    const age_days = diffDays(date, today);
    return {
      measured_at: row.measured_at,
      age_days,
      freshness: freshness(age_days),
      source: row.source,
      method: row.method,
      reliability: row.reliability,
      weight_kg: row.weight_kg == null ? null : Number(row.weight_kg),
      body_fat_pct: row.body_fat_pct == null ? null : Number(row.body_fat_pct),
      fat_mass_kg: row.fat_mass_kg == null ? null : Number(row.fat_mass_kg),
      muscle_mass_kg: row.muscle_mass_kg == null ? null : Number(row.muscle_mass_kg),
      visceral_fat_rating: row.visceral_fat_rating == null ? null : Number(row.visceral_fat_rating),
      notes: row.notes,
    };
  });

  const documents = (docRes.data || []).map((row: any) => {
    const age_days = diffDays(row.document_date, today);
    return {
      date: row.document_date,
      age_days,
      freshness: freshness(age_days),
      type: row.document_type,
      source: row.source_name,
      provider: row.provider,
      clinical_validity: row.clinical_validity,
      summary: row.summary,
    };
  });

  return {
    today,
    rule: "Lab results are dated context, not diagnosis. Always account for age_days/freshness. Old/stale results can explain history but must not be treated as current state. Non-clinical documents are not medical evidence.",
    latest_labs,
    body_composition,
    documents,
  };
}

export function formatMedicalContextBlock(ctx: Awaited<ReturnType<typeof fetchMedicalContext>>): string {
  if (!ctx.latest_labs.length && !ctx.body_composition.length && !ctx.documents.length) {
    return "[BADANIA/MEDICAL CONTEXT]: brak danych.";
  }

  const labLines = ctx.latest_labs.map((r) => {
    const trendStr = r.trend
      ? `; trend: ${r.trend.direction} ${r.trend.delta_pct > 0 ? "+" : ""}${r.trend.delta_pct}% vs ${r.trend.prior_value}${r.unit || ""} (${r.trend.prior_date})`
      : "; trend: brak poprzedniego pomiaru";
    return `- ${r.marker_name} (${r.marker_key}): ${r.value} ${r.unit || ""}; data ${r.date}; ${r.age_days} dni temu; freshness=${r.freshness}; ref=${r.ref_text || "brak"}${r.flag ? `; flaga=${r.flag}` : ""}; zrodlo=${r.source}${trendStr}`;
  });
  const bodyLines = ctx.body_composition.map((r: any) =>
    `- ${r.source}: ${r.measured_at}; ${r.age_days} dni temu; freshness=${r.freshness}; ${r.method}/${r.reliability}; masa ${r.weight_kg ?? "?"} kg; BF ${r.body_fat_pct ?? "?"}%; muscle ${r.muscle_mass_kg ?? "?"} kg; visceral ${r.visceral_fat_rating ?? "?"}`
  );
  const docLines = ctx.documents.slice(0, 8).map((r: any) =>
    `- ${r.date}; ${r.age_days} dni temu; ${r.type}; validity=${r.clinical_validity}; ${r.source}: ${r.summary}`
  );

  return `[BADANIA / KONTEKST MEDYCZNY - Z DATAMI]:
Zasada: wyniki badan sa kontekstem z data, nie diagnoza. Zawsze uwzgledniaj age_days/freshness wzgledem dzisiaj=${ctx.today}. Wyniki old/stale nie opisuja automatycznie dzisiejszego stanu. Dokumenty non_clinical_low_confidence nie sa dowodem medycznym.

Najnowsze markery per typ:
${labLines.length ? labLines.join("\n") : "- brak markerow lab"}

Sklad ciala / BIA:
${bodyLines.length ? bodyLines.join("\n") : "- brak pomiarow"}

Dokumenty zrodlowe:
${docLines.length ? docLines.join("\n") : "- brak dokumentow"}`;
}
