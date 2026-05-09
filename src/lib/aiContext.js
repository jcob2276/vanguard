import { calculateVanguardSignals, determineVanguardState } from './signalAnalytics';

/**
 * GATHER USER CONTEXT (Warstwa 6 Interface)
 * Aggregates raw events from various sources and translates them 
 * into a deterministic State Vector for the AI Advisor.
 */
export const gatherUserContext = async (supabase, userId) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Fetching data from multiple streams
  const [stayfreeResponse, biometricsResponse, dailyWinsResponse, identityResponse] = await Promise.all([
    supabase.from('stayfree_usage').select('*').eq('user_id', userId).gte('date', today),
    supabase.from('oura_daily_summary').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7),
    supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
    supabase.from('vanguard_identity').select('*').eq('user_id', userId).maybeSingle()
  ]);

  // RAW DATA CHECK
  const stayfree = stayfreeResponse.data || [];
  const oura = biometricsResponse.data || [];
  const todayWin = dailyWinsResponse.data;
  const identity = identityResponse.data;

  // WARSTWA 2: SIGNAL ENGINE (DETERMINISTIC)
  const signals = calculateVanguardSignals({ stayfree, oura, todayWin });

  // WARSTWA 4: STATE ENGINE (STATE MACHINE)
  const operationalState = determineVanguardState(signals);

  // THE STATE VECTOR - THE ONLY THING THE AI SEES
  return {
    operational_state: operationalState,
    identity: identity, // Digital Twin Core
    vector: {
      exposure_load_min: signals.metrics.exposureLoad,
      real_time_min: signals.metrics.realTimeEstimate,
      overlap_factor: signals.metrics.overlapFactor,
      fragmentation_index: signals.metrics.fragmentationIndex,
      avoidance_index: signals.metrics.avoidanceIndex,
      dopamine_load: signals.metrics.dopamineLoad,
      recovery_debt: signals.metrics.recoveryDebt,
      execution_ratio: signals.metrics.executionRatio
    },
    context: {
      top_apps: stayfree
        .sort((a, b) => b.duration_seconds - a.duration_seconds)
        .slice(0, 5)
        .map(a => ({ name: a.app_name, min: Math.round(a.duration_seconds / 60) })),
      latest_hrv: oura[0]?.hrv_average || 0,
      confidence: signals.confidence
    },
    timestamp: new Date().toISOString()
  };
};
