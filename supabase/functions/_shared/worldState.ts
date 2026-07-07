import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- TIMEZONE-SAFE DATE HELPERS ---
export function getWarsawDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });
}

export interface WorldStateMeta {
  source: string;
  freshness_hours: number;
  confidence: number;
  last_updated: string | null;
}

export interface WorldState {
  timestamp: string;
  date: string;
  user_id: string;
  biometrics: {
    sleep_hours: number | null;
    hrv_avg: number | null;
    readiness_score: number | null;
    _meta: WorldStateMeta;
  };
  execution: {
    tasks_done: number | null;
    journal_present: boolean;
    _meta: WorldStateMeta;
  };
  system: {
    final_state: string | null;
    execution_score: number | null;
    identity_score: number | null;
    _meta: WorldStateMeta;
  };
  training: {
    strain_score: number | null;
    recovery_score: number | null;
    daily_status: string | null;
    main_limiter: string | null;
    _meta: WorldStateMeta;
  };
}

export async function fetchWorldState(
  supabase: SupabaseClient,
  userId: string,
  dateStr?: string,
  nowMsOverride?: number
): Promise<WorldState> {
  const date = dateStr || getWarsawDateString();
  const nowMs = nowMsOverride || Date.now();

  const calculateFreshness = (updatedAt: string | null) => {
    if (!updatedAt) return 999;
    const diffMs = nowMs - new Date(updatedAt).getTime();
    return Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1)));
  };

  const calculateConfidence = (freshnessHours: number, thresholdHours: number) => {
    if (freshnessHours > thresholdHours) return 0.2; // Stale data
    return 1.0;
  };

  // 1. Oura Biometrics
  const { data: oura } = await supabase
    .from('oura_daily_summary')
    .select('total_sleep_hours, hrv_avg, readiness_score, updated_at')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  const ouraFreshness = calculateFreshness(oura?.updated_at);

  // 2. Daily Wins (Execution)
  const { data: wins } = await supabase
    .from('daily_wins')
    .select('done_1, done_2, done_3, done_4, done_5, journal_entry, updated_at')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  const winsFreshness = calculateFreshness(wins?.updated_at);
  let tasksDone = 0;
  if (wins) {
    if (wins.done_1) tasksDone++;
    if (wins.done_2) tasksDone++;
    if (wins.done_3) tasksDone++;
    if (wins.done_4) tasksDone++;
    if (wins.done_5) tasksDone++;
  }

  // 3. Vanguard Aggregates (System State)
  const { data: aggregate } = await supabase
    .from('vanguard_daily_aggregates')
    .select('final_state, execution_score, identity_score, updated_at')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  const aggFreshness = calculateFreshness(aggregate?.updated_at);

  // 4. Daily Strain (Training & Recovery context)
  const { data: strain } = await supabase
    .from('daily_strain')
    .select('strain_score, recovery_score, daily_status, main_limiter, updated_at')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  const strainFreshness = calculateFreshness(strain?.updated_at);

  return {
    timestamp: new Date().toISOString(),
    date,
    user_id: userId,
    biometrics: {
      sleep_hours: oura?.total_sleep_hours ?? null,
      hrv_avg: oura?.hrv_avg ?? null,
      readiness_score: oura?.readiness_score ?? null,
      _meta: {
        source: 'oura_daily_summary',
        freshness_hours: ouraFreshness,
        confidence: oura ? calculateConfidence(ouraFreshness, 24) : 0.0,
        last_updated: oura?.updated_at || null
      }
    },
    execution: {
      tasks_done: wins ? tasksDone : null,
      journal_present: !!wins?.journal_entry,
      _meta: {
        source: 'daily_wins',
        freshness_hours: winsFreshness,
        confidence: wins ? calculateConfidence(winsFreshness, 12) : 0.0,
        last_updated: wins?.updated_at || null
      }
    },
    system: {
      final_state: aggregate?.final_state ?? null,
      execution_score: aggregate?.execution_score ?? null,
      identity_score: aggregate?.identity_score ?? null,
      _meta: {
        source: 'vanguard_daily_aggregates',
        freshness_hours: aggFreshness,
        confidence: aggregate ? calculateConfidence(aggFreshness, 24) : 0.0,
        last_updated: aggregate?.updated_at || null
      }
    },
    training: {
      strain_score: strain?.strain_score ?? null,
      recovery_score: strain?.recovery_score ?? null,
      daily_status: strain?.daily_status ?? null,
      main_limiter: strain?.main_limiter ?? null,
      _meta: {
        source: 'daily_strain',
        freshness_hours: strainFreshness,
        confidence: strain ? calculateConfidence(strainFreshness, 24) : 0.0,
        last_updated: strain?.updated_at || null
      }
    }
  };
}
