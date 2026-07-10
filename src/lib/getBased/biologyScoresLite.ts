/**
 * Simplified Biology Scores — logic adapted from getbased (AGPL-3.0).
 * Pattern summaries only; not diagnoses.
 * @see https://github.com/elkimek/get-based
 */

import type { MarkerSeries } from '../health/medicalAnalytics';
import { SCORE_MARKER_KEYS, scoreHasEvidence } from '../health/medicalRetestContext';
import { bridgeForMarkerKey, GETBASED_OPTIMAL, toCanonicalValue } from './markerBridge';

export type ScoreTone = 'excellent' | 'good' | 'strained' | 'poor' | 'concerning' | 'severe';

export type BiologyScoreResult = {
  id: string;
  title: string;
  kicker: string;
  score: number | null;
  tone: ScoreTone | null;
  toneLabel: string;
  coverage: number;
  coverageLabel: string;
  summary: string;
  flags: string[];
  missing: string[];
};

const TONE_LABELS: Record<ScoreTone, string> = {
  excellent: 'Strong',
  good: 'Good',
  strained: 'Watch',
  poor: 'Low score',
  concerning: 'Concerning',
  severe: 'Severe',
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  if (inMax === inMin) return outMax;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function resolveScoreTone(score: number | null): ScoreTone | null {
  if (!Number.isFinite(score)) return null;
  if (score! >= 85) return 'excellent';
  if (score! >= 70) return 'good';
  if (score! >= 50) return 'strained';
  if (score! >= 35) return 'poor';
  if (score! >= 15) return 'concerning';
  return 'severe';
}

function scoreAgainstRange(value: number, range: { min: number | null; max: number | null }): number | null {
  if (!Number.isFinite(value)) return null;
  const { min, max } = range;
  if (min == null && max == null) return null;
  if (min == null && max != null) {
    if (value <= max) return 100;
    const buffer = Math.max(Math.abs(max) * 0.5, 1);
    return Math.round(clamp(lerp(clamp(value, max, max + buffer), max, max + buffer, 99, 0), 0, 99));
  }
  if (max == null && min != null) {
    if (value >= min) return 100;
    const buffer = Math.max(Math.abs(min) * 0.5, 1);
    return Math.round(clamp(lerp(clamp(value, min - buffer, min), min - buffer, min, 0, 99), 0, 99));
  }
  if (value >= min! && value <= max!) return 100;
  const span = Math.max(max! - min!, 1);
  if (value < min!) return Math.round(clamp(lerp(clamp(value, min! - span, min!), min! - span, min!, 0, 99), 0, 99));
  return Math.round(clamp(lerp(clamp(value, max!, max! + span), max!, max! + span, 99, 0), 0, 99));
}

function scoreHighOnly(value: number, threshold: number, highCeil: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (value <= threshold) return 100;
  const ceil = Math.max(highCeil, threshold + 1);
  return Math.round(clamp(lerp(clamp(value, threshold, ceil), threshold, ceil, 99, 0), 0, 99));
}

function scoreLowOnly(value: number, threshold: number, lowFloor = 0): number | null {
  if (!Number.isFinite(value)) return null;
  if (value >= threshold) return 100;
  return Math.round(clamp(lerp(clamp(value, lowFloor, threshold), lowFloor, threshold, 0, 99), 0, 99));
}

type Hit = { label: string; value: number; range: { min: number | null; max: number | null }; weight: number };

function hitFromSeries(series: MarkerSeries): Hit | null {
  const bridge = bridgeForMarkerKey(series.marker_key);
  if (!bridge) return null;
  const cv = toCanonicalValue(series.marker_key, series.latest.value, series.latest.unit);
  if (cv == null) return null;
  const opt = GETBASED_OPTIMAL[bridge.path];
  const range = opt
    ? { min: opt.optimalMin, max: opt.optimalMax }
    : { min: series.latest.ref_low, max: series.latest.ref_high };
  return { label: series.marker_name, value: cv, range, weight: 1 };
}

function getHit(seriesByKey: Map<string, MarkerSeries>, key: string): Hit | null {
  const s = seriesByKey.get(key);
  if (!s) return null;
  return hitFromSeries(s);
}

function finalizeScore(
  id: string,
  title: string,
  kicker: string,
  summary: string,
  parts: { hit: Hit; partial: number; weight: number; core?: boolean }[],
  missing: string[],
  flags: string[],
): BiologyScoreResult {
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0) + missing.length;
  const availableWeight = parts.reduce((s, p) => s + p.weight, 0);
  const scoreSum = parts.reduce((s, p) => s + p.partial * p.weight, 0);
  const score = availableWeight > 0 ? Math.round(scoreSum / availableWeight) : null;
  const coverage = totalWeight > 0 ? availableWeight / totalWeight : 0;
  const tone = resolveScoreTone(score);
  return {
    id,
    title,
    kicker,
    score,
    tone,
    toneLabel: tone ? TONE_LABELS[tone] : '—',
    coverage,
    coverageLabel: coverage >= 0.8 ? 'high' : coverage >= 0.45 ? 'partial' : 'low',
    summary,
    flags,
    missing,
  };
}

function computeIronHandling(seriesByKey: Map<string, MarkerSeries>): BiologyScoreResult | null {
  const ferritin = getHit(seriesByKey, 'ferritin');
  const hgb = getHit(seriesByKey, 'hemoglobin');
  if (!ferritin && !hgb) return null;

  const parts: { hit: Hit; partial: number; weight: number; core?: boolean }[] = [];
  const missing: string[] = [];
  const flags: string[] = [];

  if (ferritin) {
    const partial = Math.min(
      scoreHighOnly(ferritin.value, 300, 800) ?? 0,
      scoreLowOnly(ferritin.value, 30, 5) ?? 0,
    );
    parts.push({ hit: ferritin, partial, weight: 1.15, core: true });
    if (ferritin.value < 30) flags.push('Niski ferrytyna — możliwe wyczerpane zapasy żelaza.');
    if (ferritin.value > 300) flags.push('Wysoki ferrytyna — kontekst stanu zapalnego / przeciążenia.');
  } else missing.push('Ferrytyna');

  if (hgb) {
    parts.push({ hit: hgb, partial: scoreAgainstRange(hgb.value, hgb.range) ?? 50, weight: 0.8, core: true });
  } else missing.push('Hemoglobina');

  const mcv = getHit(seriesByKey, 'mcv');
  if (mcv) parts.push({ hit: mcv, partial: scoreAgainstRange(mcv.value, mcv.range) ?? 50, weight: 0.5 });

  return finalizeScore(
    'ironHandling',
    'Żelazo / krew',
    'Ferrytyna + morfologia',
    'Wzorzec dostępności żelaza (uproszczony Iron Handling z getbased).',
    parts,
    missing,
    flags,
  );
}

function computeLipidPattern(seriesByKey: Map<string, MarkerSeries>): BiologyScoreResult | null {
  const inputs: { key: string; weight: number; core?: boolean; label: string }[] = [
    { key: 'hdl_cholesterol', weight: 1.2, core: true, label: 'HDL' },
    { key: 'ldl_cholesterol_calculated', weight: 1.1, core: true, label: 'LDL' },
    { key: 'triglycerides', weight: 1.0, core: true, label: 'TG' },
    { key: 'cholesterol_total', weight: 0.7, label: 'Chol. całk.' },
    { key: 'non_hdl_cholesterol', weight: 0.8, label: 'Non-HDL' },
  ];
  const parts: { hit: Hit; partial: number; weight: number; core?: boolean }[] = [];
  const missing: string[] = [];
  const flags: string[] = [];

  for (const inp of inputs) {
    const hit = getHit(seriesByKey, inp.key);
    if (!hit) {
      if (inp.core) missing.push(inp.label);
      continue;
    }
    const partial = scoreAgainstRange(hit.value, hit.range) ?? 50;
    if (inp.key === 'ldl_cholesterol_calculated' && hit.range.max != null && hit.value > hit.range.max) {
      flags.push('LDL powyżej optymalnego pasma — kierunek CV do omówienia z lekarzem.');
    }
    parts.push({ hit, partial, weight: inp.weight, core: inp.core });
  }

  if (parts.length === 0) return null;
  return finalizeScore(
    'lipidPattern',
    'Lipidogram',
    'HDL · LDL · TG',
    'Wzorzec lipidowy na zakresach optymalnych getbased.',
    parts,
    missing,
    flags,
  );
}

function computeThyroidContext(seriesByKey: Map<string, MarkerSeries>): BiologyScoreResult | null {
  const tsh = getHit(seriesByKey, 'tsh');
  if (!tsh) return null;
  const partial = Math.round(clamp(1 / (1 + Math.abs(tsh.value - 1.5) / 1.2), 0.35, 1) * 100);
  const flags: string[] = [];
  if (tsh.value > 2.5) flags.push('TSH blisko / powyżej górnej granicy optymalnej.');
  return finalizeScore(
    'thyroidContext',
    'Tarczyca',
    'TSH (uproszczony)',
    'Pełny Thyroid Coherence w getbased wymaga FT3/FT4.',
    [{ hit: tsh, partial, weight: 1, core: true }],
    ['Free T3', 'Free T4'],
    flags,
  );
}

function computeVitaminDMineral(seriesByKey: Map<string, MarkerSeries>): BiologyScoreResult | null {
  const vd = getHit(seriesByKey, 'vitamin_d_25oh');
  const mg = getHit(seriesByKey, 'magnesium_serum');
  if (!vd && !mg) return null;
  const parts: { hit: Hit; partial: number; weight: number; core?: boolean }[] = [];
  const missing: string[] = [];
  if (vd) parts.push({ hit: vd, partial: scoreAgainstRange(vd.value, vd.range) ?? 50, weight: 1.45, core: true });
  else missing.push('Witamina D');
  if (mg) parts.push({ hit: mg, partial: scoreAgainstRange(mg.value, mg.range) ?? 50, weight: 0.55 });
  else missing.push('Magnez');
  return finalizeScore(
    'vitaminDMineral',
    'D + minerały',
    'Wit. D · magnez',
    'Fragment Bone & Mineral Balance z getbased.',
    parts,
    missing,
    [],
  );
}

function computeMetabolicGlucose(seriesByKey: Map<string, MarkerSeries>): BiologyScoreResult | null {
  const glu = getHit(seriesByKey, 'glucose');
  if (!glu) return null;
  return finalizeScore(
    'metabolicGlucose',
    'Glukoza',
    'Metabolizm',
    'Bez insuliny/HbA1c to tylko pojedynczy sygnał glukozy.',
    [{ hit: glu, partial: scoreAgainstRange(glu.value, glu.range) ?? 50, weight: 1, core: true }],
    ['Insulina', 'HbA1c'],
    [],
  );
}

function applyScoreEvidenceGate(
  score: BiologyScoreResult,
  byKey: Map<string, MarkerSeries>,
): BiologyScoreResult {
  const keys = SCORE_MARKER_KEYS[score.id];
  if (!keys || scoreHasEvidence(byKey, keys)) return score;
  return {
    ...score,
    score: null,
    tone: null,
    toneLabel: 'Brak danych',
    flags: [
      'Potrzebny świeży panel (<180 dni) albo drugi pomiar tego samego markera.',
      ...score.flags,
    ],
  };
}

export function computeBiologyScoresLite(series: MarkerSeries[]): BiologyScoreResult[] {
  const byKey = new Map(series.map((s) => [s.marker_key, s]));
  const scores = [
    computeIronHandling(byKey),
    computeLipidPattern(byKey),
    computeThyroidContext(byKey),
    computeVitaminDMineral(byKey),
    computeMetabolicGlucose(byKey),
  ].filter(Boolean) as BiologyScoreResult[];

  return scores.map((s) => applyScoreEvidenceGate(s, byKey));
}

export function toneColorClass(tone: ScoreTone | null): string {
  switch (tone) {
    case 'excellent':
    case 'good':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'strained':
      return 'text-amber-600 dark:text-amber-400';
    case 'poor':
    case 'concerning':
    case 'severe':
      return 'text-rose-600 dark:text-rose-400';
    default:
      return 'text-text-muted';
  }
}
