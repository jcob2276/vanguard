import { supabase } from '../supabase';
import { getTodayWarsaw } from '../date';
import {
  type OuraDecodedHrvRmssd,
  type OuraDecodedSleepPhase,
  type OuraDecodedTemp,
  type OuraDecodedBattery,
} from '@vanguard/domain';

export interface OuraBleNightPayload {
  date?: string;
  hrvSamples: OuraDecodedHrvRmssd[];
  sleepPhases: OuraDecodedSleepPhase[];
  tempDelta?: OuraDecodedTemp;
  battery?: OuraDecodedBattery;
}

const CURSOR_STORAGE_KEY = 'vanguard_oura_ble_cursor';
const BLE_MODE_KEY = 'vanguard_oura_ble_mode_enabled';

export function getOuraBleCursor(): number {
  try {
    const val = localStorage.getItem(CURSOR_STORAGE_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export function saveOuraBleCursor(cursor: number): void {
  try {
    localStorage.setItem(CURSOR_STORAGE_KEY, cursor.toString());
  } catch {
    /* ignore */
  }
}

export function isOuraBleModeEnabled(): boolean {
  try {
    return localStorage.getItem(BLE_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOuraBleModeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BLE_MODE_KEY, enabled ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

/**
 * Saves processed Oura Ring BLE night data directly to Supabase tables.
 */
export async function persistOuraBleNightData(userId: string, payload: OuraBleNightPayload): Promise<boolean> {
  const dateStr = payload.date || getTodayWarsaw();

  // 1. Calculate average HRV
  const avgHrv = payload.hrvSamples.length > 0
    ? Math.round(payload.hrvSamples.reduce((acc, s) => acc + s.rmssdValue, 0) / payload.hrvSamples.length)
    : null;

  // 2. Calculate sleep phase durations in hours
  let deepSec = 0;
  let remSec = 0;
  let lightSec = 0;
  payload.sleepPhases.forEach((p) => {
    if (p.phaseName === 'deep') deepSec += 30;
    else if (p.phaseName === 'rem') remSec += 30;
    else if (p.phaseName === 'light') lightSec += 30;
  });

  const totalSleepHours = (deepSec + remSec + lightSec) / 3600;
  const deepSleepHours = deepSec / 3600;
  const remSleepHours = remSec / 3600;

  const summaryPayload = {
    user_id: userId,
    date: dateStr,
    hrv_avg: avgHrv,
    total_sleep_hours: totalSleepHours > 0 ? totalSleepHours : null,
    deep_sleep_hours: deepSleepHours > 0 ? deepSleepHours : null,
    rem_sleep_hours: remSleepHours > 0 ? remSleepHours : null,
    temp_deviation: payload.tempDelta ? payload.tempDelta.tempDeltaCelsius : null,
    readiness_score: avgHrv && avgHrv > 40 ? 85 : 70, // Local estimation
  };

  const { error } = await supabase
    .from('oura_daily_summary')
    .upsert(summaryPayload, { onConflict: 'user_id,date' });

  if (error) {
    console.error('[OuraBleSync] Failed to persist BLE night summary to Supabase:', error);
    return false;
  }

  console.log(`[OuraBleSync] Successfully persisted Oura BLE night summary for date ${dateStr} (HRV: ${avgHrv})`);
  return true;
}
