import { useMemo } from 'react';
import {
  getSunTimes,
  getMoonPhase,
  formatTimeWarsaw,
  type SunTimes,
  type MoonPhaseInfo,
} from '../lib/solar';

export interface SolarData {
  sunTimes: SunTimes;
  moon: MoonPhaseInfo;
  sunriseStr: string;
  sunsetStr: string;
  /** Procent dnia (0–100) który minął między wschodem a zachodem — do progress bar */
  dayProgressPct: number;
}

/**
 * Hook zwracający dane astronomiczne dla danego dnia (YYYY-MM-DD).
 * Synchroniczny — zero fetch, czysta matematyka. Memoizowany per dateStr.
 */
export function useSolarData(dateStr: string): SolarData {
  return useMemo(() => {
    const sunTimes = getSunTimes(dateStr);
    const moon = getMoonPhase(dateStr);

    const sunriseStr = formatTimeWarsaw(sunTimes.sunrise);
    const sunsetStr = formatTimeWarsaw(sunTimes.sunset);

    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const isToday = dateStr === new Date().toISOString().slice(0, 10);
    const dayProgressPct = isToday
      ? Math.max(
          0,
          Math.min(
            100,
            ((nowMin - sunTimes.sunriseMin) /
              (sunTimes.sunsetMin - sunTimes.sunriseMin)) *
              100
          )
        )
      : 0;

    return { sunTimes, moon, sunriseStr, sunsetStr, dayProgressPct };
  }, [dateStr]);
}
