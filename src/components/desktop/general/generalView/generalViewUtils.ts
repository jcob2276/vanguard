import { GeneralViewStrain, GeneralViewOura } from '../hooks/useGeneralViewData';

export interface TimelineItem {
  d: string;
  date: string;
  recovery: number | null;
  strain: number | null;
  readiness: string | null;
  hrv: number | null;
  rhr: number | null;
  sleepH: number | null;
  sleepScore: number | null;
  hrv_z: number | null;
  rhr_z: number | null;
  sleep_z: number | null;
  ouraReadiness: number | null;
}

export function buildTimeline(
  strainRows: GeneralViewStrain[],
  ouraRows: GeneralViewOura[]
): TimelineItem[] {
  const ouraMap = Object.fromEntries(ouraRows.map((r) => [r.date, r]));
  const strainMap = Object.fromEntries(strainRows.map((r) => [r.date, r]));
  const dates = [...new Set([...strainRows.map((r) => r.date), ...ouraRows.map((r) => r.date)])].sort();

  return dates.map((date) => {
    const s = strainMap[date] || {};
    const o = ouraMap[date] || {};
    const comp = (s.components as Record<string, number> | null) || {};
    return {
      d: date.slice(5),
      date,
      recovery: s.recovery_score ?? null,
      strain: s.strain_score ?? null,
      readiness: s.readiness_level ?? null,
      hrv: o.hrv_avg ?? null,
      rhr: o.rhr_avg ?? null,
      sleepH: o.total_sleep_hours ?? null,
      sleepScore: o.sleep_score ?? o.sleep_efficiency ?? null,
      hrv_z: comp.hrv_z ?? null,
      rhr_z: comp.rhr_z ?? null,
      sleep_z: comp.sleep_z ?? null,
      ouraReadiness: o.readiness_score ?? null,
    };
  });
}

export function buildSleepHrvScatter(ouraRows: GeneralViewOura[]) {
  return ouraRows
    .slice(0, -1)
    .map((r, i) => ({
      sleep: r.total_sleep_hours != null ? Number(r.total_sleep_hours) : null,
      hrvNext: ouraRows[i + 1]?.hrv_avg != null ? Number(ouraRows[i + 1].hrv_avg) : null,
    }))
    .filter((r) => r.sleep != null && r.hrvNext != null && Number.isFinite(r.sleep) && Number.isFinite(r.hrvNext));
}
