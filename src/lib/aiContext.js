import { supabase } from './supabase';
import { VanguardCore, computeSignals } from './vanguardCore';
import { format } from 'date-fns';

/**
 * AI CONTEXT 3.0 - Unified Bridge to VanguardCore
 * Eliminates architectural schizophrenia by using the same engine as AIInsight.
 */
export async function gatherUserContext(session) {
  if (!session?.user?.id) return "Brak sesji użytkownika.";

  const userId = session.user.id;
  const today = format(new Date(), 'yyyy-MM-dd');
  const core = new VanguardCore(userId, supabase);

  try {
    // UNIFIED FETCH (Same as AIInsight)
    const [stayfreeRes, latestOuraRes, powerListRes, historyRes] = await Promise.all([
      supabase.from('stayfree_usage').select('*').eq('user_id', userId).eq('date', today),
      supabase.from('oura_daily_summary').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('vanguard_daily_aggregates').select('*').eq('user_id', userId).order('date', { ascending: true })
    ]);

    const stayfreeToday = stayfreeRes.data || [];
    const latestOura = latestOuraRes.data;
    const powerListToday = powerListRes.data;
    const history = historyRes.data || [];

    // 1. CALCULATE SIGNALS & STATE
    const currentMetrics = computeSignals(stayfreeToday, latestOura, powerListToday);
    const personalBaseline = await core.getPersonalBaseline();
    const vanguardState = await core.determineState(currentMetrics, personalBaseline);

    // 2. CONSTRUCT UNIFIED STATE VECTOR
    const stateVector = {
      state: vanguardState,
      metrics: {
        execution: currentMetrics.execution_ratio || 0,
        biological: {
          sleep_z: currentMetrics.sleep ? (currentMetrics.sleep - personalBaseline.means.sleep) / (personalBaseline.stdDevs.sleep || 1) : 0,
          hrv_z: currentMetrics.hrv ? (currentMetrics.hrv - personalBaseline.means.hrv) / (personalBaseline.stdDevs.hrv || 1) : 0,
          readiness: currentMetrics.readiness || 0
        },
        digital: {
          dopamine_z: currentMetrics.dopamine_load ? (currentMetrics.dopamine_load - personalBaseline.means.dopamine_load) / (personalBaseline.stdDevs.dopamine_load || 1) : 0,
          fragmentation_z: currentMetrics.fragmentation ? (currentMetrics.fragmentation - personalBaseline.means.fragmentation) / (personalBaseline.stdDevs.fragmentation || 1) : 0,
          screen_time: currentMetrics.screen_time_min || 0
        }
      },
      predictions: await core.computePredictions(currentMetrics, history, personalBaseline),
      identity_vault: await core.evaluateIdentityVault() 
    };

    return `VANGUARD_STATE_VECTOR: ${JSON.stringify(stateVector, null, 2)}`;

  } catch (error) {
    console.error("Context Gathering Error:", error);
    return "Błąd podczas zbierania kontekstu Vanguard.";
  }
}
