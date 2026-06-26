import { diffDaysFromToday, type MarkerSeries, type MedicalLabRow } from './medicalAnalytics';

export type FullPanelInfo = {
  date: string;
  markerCount: number;
  ageDays: number | null;
  sourceName: string | null;
};

/** Najnowsza data z dużym zestawem markerów (np. Pakiet 20+). */
export function findLatestFullPanel(
  byDate: Map<string, MedicalLabRow[]>,
  minMarkers = 8,
): FullPanelInfo | null {
  for (const [date, rows] of byDate) {
    if (rows.length >= minMarkers) {
      return {
        date,
        markerCount: rows.length,
        ageDays: diffDaysFromToday(date),
        sourceName: rows[0]?.source_name ?? null,
      };
    }
  }
  const fallback = [...byDate.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (fallback && fallback[1].length >= 3) {
    return {
      date: fallback[0],
      markerCount: fallback[1].length,
      ageDays: diffDaysFromToday(fallback[0]),
      sourceName: fallback[1][0]?.source_name ?? null,
    };
  }
  return null;
}

export const SCORE_MARKER_KEYS: Record<string, string[]> = {
  ironHandling: ['ferritin', 'hemoglobin'],
  lipidPattern: ['hdl_cholesterol', 'ldl_cholesterol_calculated', 'triglycerides', 'cholesterol_total'],
  thyroidContext: ['tsh'],
  vitaminDMineral: ['vitamin_d_25oh', 'magnesium_serum'],
  metabolicGlucose: ['glucose'],
};

/** Score liczony tylko przy świeżym panelu (<180d) LUB ≥2 pomiarach któregoś markera w score. */
export function scoreHasEvidence(byKey: Map<string, MarkerSeries>, markerKeys: string[]): boolean {
  const relevant = markerKeys.map((k) => byKey.get(k)).filter(Boolean) as MarkerSeries[];
  if (relevant.length === 0) return false;

  const freshPanel = relevant.some((s) => {
    const age = diffDaysFromToday(s.latest.result_date);
    return age != null && age <= 180;
  });
  const hasTrend = relevant.some((s) => s.history.length >= 2);
  return freshPanel || hasTrend;
}
