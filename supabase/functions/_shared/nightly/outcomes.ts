import { HEALTH_THRESHOLDS } from '@vanguard/domain';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getWarsawDateString } from '../time.ts';


const mapCatalogMetricToColumn = (metric: string | null): string => {
  if (!metric) return 'execution_score';
  switch (metric) {
    case 'sleep_h':
    case 'sleep_hours':
      return 'sleep_hours';
    case 'readiness':
    case 'readiness_score':
      return 'readiness_score';
    case 'execution_score':
      return 'execution_score';
    case 'identity_score':
      return 'identity_score';
    case 'screen_time_min':
      return 'screen_time_min';
    case 'dopamine_load_index':
      return 'dopamine_load_index';
    case 'fragmentation_index':
      return 'fragmentation_index';
    case 'hrv':
    case 'hrv_avg':
      return 'hrv_avg';
    case 'rhr':
    case 'rhr_avg':
      return 'rhr_avg';
    case 'temp_deviation':
      return 'temp_deviation';
    default:
      return 'execution_score';
  }
};

const isMetricSuccessful = (metric: string, value: number): boolean => {
  switch (metric) {
    case 'sleep_hours':
      return value >= 7.0;
    case 'readiness_score':
      return value >= HEALTH_THRESHOLDS.READINESS_SUCCESS;
    case 'execution_score':
      return value >= 0.80;
    case 'identity_score':
      return value >= 0.70;
    case 'screen_time_min':
      return value <= 150.0; // lower is better
    case 'dopamine_load_index':
      return value <= 0.40; // lower is better
    case 'fragmentation_index':
      return value <= 0.40; // lower is better
    case 'hrv_avg':
      return value >= 50.0;
    case 'rhr_avg':
      return value <= 65.0; // lower is better
    case 'temp_deviation':
      return Math.abs(value) <= 0.5; // deviation close to 0 is good
    default:
      return value >= 0.80;
  }
};

const formatAvg = (m: string, val: number): string => {
  if (m === 'sleep_hours') return `${val.toFixed(1)}h`;
  if (m === 'dopamine_load_index' || m === 'fragmentation_index' || m === 'temp_deviation') return val.toFixed(2);
  if (m === 'execution_score' || m === 'identity_score') return `${Math.round(val * 100)}%`;
  return val.toFixed(1);
};

const thresholdLabel = (m: string): string => {
  switch (m) {
    case 'sleep_hours': return '>= 7.0h';
    case 'readiness_score': return `>= ${HEALTH_THRESHOLDS.READINESS_SUCCESS}`;
    case 'execution_score': return '>= 80%';
    case 'identity_score': return '>= 70%';
    case 'screen_time_min': return '<= 150m';
    case 'dopamine_load_index': return '<= 0.40';
    case 'fragmentation_index': return '<= 0.40';
    case 'hrv_avg': return '>= 50';
    case 'rhr_avg': return '<= 65';
    case 'temp_deviation': return '<= 0.5';
    default: return '>= 80%';
  }
};

export const runPatternOutcomes = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<void> => {
  console.log('[pattern-outcomes] Starting windowed join analysis');
  const { data: patterns, error: patternsError } = await supabase
    .from('vanguard_behavioral_patterns')
    .select('id, title, status, user_id, signature, confidence, outcome_metric')
    .eq('user_id', userId);
  if (patternsError) throw patternsError;
  if (!patterns) return;

  const todayStr = getWarsawDateString();

  for (const pattern of patterns) {
    if (pattern.status === 'user_rejected') continue;
    
    // Get all events for this pattern
    const { data: events, error: eventsError } = await supabase
      .from('pattern_events')
      .select('occurred_on')
      .eq('pattern_id', pattern.id);
    if (eventsError) throw eventsError;
    if (!events || events.length === 0) continue;

    let successfulWindows = 0;
    let globalSumAdherence = 0;
    let globalCountAdherence = 0;
    let resolvedCountForPattern = 0;
    let successfulResolvedCountForPattern = 0;

    const metricColumn = mapCatalogMetricToColumn(pattern.outcome_metric);

    for (const ev of events) {
      const start = new Date(ev.occurred_on + 'T12:00:00Z');
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 9);

      const startStr = ev.occurred_on;
      const endStr = end.toISOString().split('T')[0];

      // Rozstrzygamy prognozę, jeśli pełne 9-dniowe okno się zakończyło (endStr < dzisiaj)
      const isResolved = endStr < todayStr;

      const { data: facts, error: factsError } = await supabase
        .from('vanguard_daily_aggregates')
        .select(`date, ${metricColumn}`)
        .eq('user_id', pattern.user_id)
        .gte('date', startStr)
        .lte('date', endStr);
      if (factsError) throw factsError;
      
      let windowSum = 0;
      let windowCount = 0;
      if (facts && facts.length > 0) {
        for (const f of facts) {
          const val = f[metricColumn as keyof typeof f] as number | null;
          if (val != null) {
            windowSum += val;
            windowCount++;
            globalSumAdherence += val;
            globalCountAdherence++;
          }
        }
      }

      let held = false;
      if (windowCount > 0) {
        const windowAvg = windowSum / windowCount;
        if (isMetricSuccessful(metricColumn, windowAvg)) {
          successfulWindows++;
          held = true;
        }
      }

      if (isResolved) {
        resolvedCountForPattern++;
        if (held) {
          successfulResolvedCountForPattern++;
        }

        // Zapisujemy pojedynczą prognozę do vanguard_predictions
        const predConfidence = pattern.confidence ?? 0.65;
        const actualVal = held ? 1.0 : 0.0;
        const brierScore = Math.pow(predConfidence - actualVal, 2);

        const { error: predictionError } = await supabase
          .from('vanguard_predictions')
          .upsert({
            user_id: pattern.user_id,
            prediction_date: endStr,
            prediction_type: 'pattern',
            metric: pattern.signature,
            predicted_value: predConfidence,
            actual_value: actualVal,
            error_value: brierScore,
            status: 'resolved',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,prediction_date,prediction_type,metric'
          });
        if (predictionError) throw predictionError;
      }
    }

    if (events.length > 0) {
      const totalAvgAdherence = globalCountAdherence > 0 
        ? (globalSumAdherence / globalCountAdherence)
        : 0;
      
      const metricLabel = pattern.outcome_metric || 'execution_score';
      const evidence_text = `Wystąpił ${events.length}×, w ${successfulWindows}/${events.length} przypadków średnia ${metricLabel} w 9-dniowym oknie po wystąpieniu wynosiła ${thresholdLabel(metricColumn)} (średnia w oknach: ${formatAvg(metricColumn, totalAvgAdherence)}).`;
      
      // Obliczamy nową pewność empiryczną na podstawie rozstrzygniętych prognoz
      let newConfidence = pattern.confidence ?? 0.65;
      if (resolvedCountForPattern > 0) {
        newConfidence = successfulResolvedCountForPattern / resolvedCountForPattern;
        // Ograniczamy pewność w przedziale 0.1 - 0.98, by uniknąć absolutnej pewności
        newConfidence = Math.max(0.1, Math.min(0.98, parseFloat(newConfidence.toFixed(2))));
      }

      const { error: patternUpdateError } = await supabase
        .from('vanguard_behavioral_patterns')
        .update({
          evidence_text,
          confidence: newConfidence,
          updated_at: new Date().toISOString()
        })
        .eq('id', pattern.id);
      if (patternUpdateError) throw patternUpdateError;
      
      console.log(`[pattern-outcomes] Updated pattern ${pattern.id} (${pattern.signature}): confidence=${newConfidence}, evidence: ${evidence_text}`);
    }
  }
};
