/**
 * Runtime type guards for critical JSONB columns.
 *
 * PROBLEM: database.types.ts types every JSONB column as `Json` (= string | number | boolean
 * | null | object | array). TypeScript accepts `as unknown as T` casts without validation.
 * If the DB schema or edge-function output changes, runtime crashes occur silently.
 *
 * SOLUTION: Narrow functions that return `T | null` — callers handle null gracefully.
 * Never throw; degrade to null and let the caller decide (show placeholder, skip section, etc.).
 *
 * USAGE:
 *   // Before (unsafe):
 *   const state = wsRow.state_json as unknown as WorldState;
 *
 *   // After (safe):
 *   const state = parseWorldState(wsRow.state_json);
 *   if (!state) { ... handle missing data ... }
 *
 * HOW TO ADD A NEW GUARD:
 *   1. Define the interface (or import it from its existing file).
 *   2. Write a `parseFoo(raw: Json): Foo | null` function.
 *   3. Replace the `as unknown as Foo` cast at the call site.
 *   4. Lower `patternCount_asUnknown` in scripts/ops/ratchet-baseline.json.
 */

import type { Json, Tables } from './database.types';
import type { GcHrZone, StravaSplit, StravaBestEffort } from './stats/exportStatsTypes';
import type { WorldState } from './dashboardApi';
import type { DataCoverage } from './systemApi';

// Mirrors src/components/lifestyle/usePowerListTypes.ts's DailyWinWithTasks — duplicated
// (not imported) because src/lib must not import from src/components.
type DailyWinWithTasks = Tables<'daily_wins'> & {
  daily_win_tasks?: Tables<'daily_win_tasks'>[];
};

export interface StrainComponents {
  recovery_confidence?: 'calibrating' | 'building' | 'solid';
  strain_confidence?: 'calibrating' | 'building' | 'solid';
  caffeine_active_mg?: number | null;
  sleep_debt_h?: number | null;
  hrv_z?: number | null;
  rhr_z?: number | null;
  sleep_score_today?: number | null;
  sleep_z?: number | null;
  fueling_score?: number | null;
  readiness_signals?: Array<{ key: string; flag: string; detail: string }> | null;
  wellness_load?: number | null;
  explanation?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

// ─── WorldState (vanguard_world_state.state_json) ────────────────────────────
//
// Call sites: dashboardApi.ts:50
// Risk: entire dashboard pipeline depends on this; field additions in edge fn
//       produce undefined at runtime with no TypeScript warning.

export function parseWorldState(raw: Json): WorldState | null {
  if (!isObject(raw)) return null;
  return {
    biometrics: isObject(raw.biometrics)
      ? {
          readiness_score:
            typeof (raw.biometrics as Record<string, unknown>).readiness_score === 'number'
              ? ((raw.biometrics as Record<string, unknown>).readiness_score as number)
              : null,
          oura_history: isArray((raw.biometrics as Record<string, unknown>).oura_history)
            ? ((raw.biometrics as Record<string, unknown>).oura_history as unknown[])
            : null,
        }
      : { readiness_score: null, oura_history: null },
    execution: isObject(raw.execution)
      ? {
          today_win:
            isObject((raw.execution as Record<string, unknown>).today_win)
              ? ((raw.execution as Record<string, unknown>).today_win as WorldState['execution']['today_win'])
              : null,
        }
      : { today_win: null },
    training: isObject(raw.training)
      ? {
          has_workout_today:
            (raw.training as Record<string, unknown>).has_workout_today === true,
        }
      : { has_workout_today: false },
    nutrition: isObject(raw.nutrition)
      ? {
          weekly_calories:
            typeof (raw.nutrition as Record<string, unknown>).weekly_calories === 'number'
              ? ((raw.nutrition as Record<string, unknown>).weekly_calories as number)
              : null,
          protein_today:
            typeof (raw.nutrition as Record<string, unknown>).protein_today === 'number'
              ? ((raw.nutrition as Record<string, unknown>).protein_today as number)
              : null,
        }
      : { weekly_calories: null, protein_today: null },
  };
}

// ─── StrainComponents (daily_strain.components / oura_daily_strain.components) ─
//
// Call sites: DailyStrainCard.tsx:99
// Risk: edge function adds new fields → UI reads undefined with no warning.

export function parseStrainComponents(raw: Json): StrainComponents | null {
  if (!isObject(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    recovery_confidence:
      r.recovery_confidence === 'calibrating' ||
      r.recovery_confidence === 'building' ||
      r.recovery_confidence === 'solid'
        ? r.recovery_confidence
        : undefined,
    strain_confidence:
      r.strain_confidence === 'calibrating' ||
      r.strain_confidence === 'building' ||
      r.strain_confidence === 'solid'
        ? r.strain_confidence
        : undefined,
    caffeine_active_mg: typeof r.caffeine_active_mg === 'number' ? r.caffeine_active_mg : null,
    sleep_debt_h: typeof r.sleep_debt_h === 'number' ? r.sleep_debt_h : null,
    hrv_z: typeof r.hrv_z === 'number' ? r.hrv_z : null,
    rhr_z: typeof r.rhr_z === 'number' ? r.rhr_z : null,
    sleep_score_today: typeof r.sleep_score_today === 'number' ? r.sleep_score_today : null,
    sleep_z: typeof r.sleep_z === 'number' ? r.sleep_z : null,
    fueling_score: typeof r.fueling_score === 'number' ? r.fueling_score : null,
    readiness_signals: isArray(r.readiness_signals)
      ? (r.readiness_signals as Array<{ key: string; flag: string; detail: string }>)
      : null,
    wellness_load: typeof r.wellness_load === 'number' ? r.wellness_load : null,
    explanation: typeof r.explanation === 'string' ? r.explanation : null,
  };
}

// ─── GcHrZone[] (strava_activities_clean.gc_hr_zones) ───────────────────────
//
// Call sites: exportStatsStrava.ts:77
// Risk: Garmin Connect field rename → NaN in zone minutes, silent bad export.

export function parseGcHrZones(raw: Json): GcHrZone[] | null {
  if (!isArray(raw)) return null;
  return raw
    .filter(isObject)
    .map((z) => ({
      secsInZone:
        typeof (z as Record<string, unknown>).secsInZone === 'number'
          ? ((z as Record<string, unknown>).secsInZone as number)
          : null,
    }));
}

// ─── StravaSplit[] (strava_activities_clean.splits_with_hr) ─────────────────
//
// Call sites: exportStatsStrava.ts:121

export function parseStravaSplits(raw: Json): StravaSplit[] | null {
  if (!isArray(raw)) return null;
  return raw.filter(isObject).map((s) => {
    const r = s as Record<string, unknown>;
    return {
      split: typeof r.split === 'number' ? r.split : null,
      moving_time: typeof r.moving_time === 'number' ? r.moving_time : null,
      distance: typeof r.distance === 'number' ? r.distance : null,
      average_speed: typeof r.average_speed === 'number' ? r.average_speed : null,
      average_heartrate: typeof r.average_heartrate === 'number' ? r.average_heartrate : null,
      average_grade_adjusted_speed:
        typeof r.average_grade_adjusted_speed === 'number'
          ? r.average_grade_adjusted_speed
          : null,
      elevation_difference:
        typeof r.elevation_difference === 'number' ? r.elevation_difference : null,
      elapsed_time: typeof r.elapsed_time === 'number' ? r.elapsed_time : null,
    };
  });
}

// ─── StravaBestEffort[] (strava_activities_clean.best_efforts) ──────────────
//
// Call sites: exportStatsStrava.ts:150

export function parseStravaBestEfforts(raw: Json): StravaBestEffort[] | null {
  if (!isArray(raw)) return null;
  return raw.filter(isObject).filter((e) => {
    const r = e as Record<string, unknown>;
    return typeof r.name === 'string' && typeof r.moving_time === 'number';
  }).map((e) => {
    const r = e as Record<string, unknown>;
    return {
      name: r.name as string,
      moving_time: r.moving_time as number,
      pr_rank: typeof r.pr_rank === 'number' ? r.pr_rank : null,
    };
  });
}

// ─── DailyWinWithTasks (daily_wins + daily_win_tasks relation) ────────────────
//
// Call sites: usePowerListEffects.ts:108

export function parseDailyWinWithTasks(raw: unknown): DailyWinWithTasks | null {
  if (!isObject(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.date !== 'string') return null;

  const daily_win_tasks = isArray(r.daily_win_tasks)
    ? (r.daily_win_tasks.filter(isObject) as unknown as Tables<'daily_win_tasks'>[])
    : undefined;

  return {
    ...r,
    daily_win_tasks,
  } as unknown as DailyWinWithTasks;
}

// ─── DataCoverage (returned from get_data_coverage RPC) ──────────────────────
//
// Call sites: systemApi.ts:68

export function parseDataCoverage(raw: unknown): DataCoverage | null {
  if (!isObject(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    oura_30: typeof r.oura_30 === 'number' ? r.oura_30 : 0,
    oura_90: typeof r.oura_90 === 'number' ? r.oura_90 : 0,
    nutrition_30: typeof r.nutrition_30 === 'number' ? r.nutrition_30 : 0,
    nutrition_90: typeof r.nutrition_90 === 'number' ? r.nutrition_90 : 0,
    wins_30: typeof r.wins_30 === 'number' ? r.wins_30 : 0,
    wins_90: typeof r.wins_90 === 'number' ? r.wins_90 : 0,
    overall_30: typeof r.overall_30 === 'number' ? r.overall_30 : 0,
    overall_90: typeof r.overall_90 === 'number' ? r.overall_90 : 0,
  };
}
