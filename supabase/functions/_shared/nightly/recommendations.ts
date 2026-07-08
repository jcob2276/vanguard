import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RecommendationRow {
  id: string;
  created_at: string;
  related_metric: string;
  success_threshold: number | null;
  evaluation_window_days: number;
}

export async function resolveOracleRecommendations(
  supabase: SupabaseClient,
  userId: string,
  todayStr: string
): Promise<{ resolved: number; successes: number; fails: number; no_data: number }> {
  console.log('[recommendations] Running recommendations outcome evaluation...');

  const { data: pendingRecs, error: fetchErr } = await supabase
    .from('oracle_recommendations')
    .select('id, created_at, related_metric, success_threshold, evaluation_window_days')
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (fetchErr) {
    console.error('[recommendations] Failed to fetch pending recommendations:', fetchErr.message);
    return { resolved: 0, successes: 0, fails: 0, no_data: 0 };
  }

  if (!pendingRecs || pendingRecs.length === 0) {
    console.log('[recommendations] No pending recommendations to evaluate.');
    return { resolved: 0, successes: 0, fails: 0, no_data: 0 };
  }

  let resolved = 0;
  let successes = 0;
  let fails = 0;
  let no_data = 0;

  for (const rec of pendingRecs as RecommendationRow[]) {
    const createdDate = new Date(rec.created_at);
    
    // Evaluation window: starts the day after creation, ends created_at + evaluation_window_days
    const startWindowDate = new Date(createdDate.getTime() + 1 * 24 * 60 * 60 * 1000);
    const endWindowDate = new Date(createdDate.getTime() + rec.evaluation_window_days * 24 * 60 * 60 * 1000);
    
    const startStr = startWindowDate.toISOString().split('T')[0];
    const endStr = endWindowDate.toISOString().split('T')[0];

    // Check if the evaluation window has closed
    if (todayStr <= endStr) {
      // Evaluation window is still active, skip
      continue;
    }

    // Walidacja czy metryka jest bezpieczna / na allowliście przed wstrzyknięciem do selecta PostgREST
    const ALLOWED_METRICS = ['sleep_hours', 'readiness_score', 'execution_score'];
    if (!ALLOWED_METRICS.includes(rec.related_metric)) {
      console.error(`[recommendations] Invalid/unsafe metric requested for recommendation ${rec.id}: ${rec.related_metric}`);
      continue;
    }

    console.log(`[recommendations] Evaluating recommendation ${rec.id}. Metric: ${rec.related_metric}, Window: ${startStr} to ${endStr}`);

    // Baseline window: 7 days before creation date up to creation date
    const baselineStartDate = new Date(createdDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const baselineStartStr = baselineStartDate.toISOString().split('T')[0];
    const baselineEndStr = createdDate.toISOString().split('T')[0];

    // Fetch metric values for evaluation window and baseline window
    const [actualRes, baselineRes] = await Promise.all([
      supabase
        .from('vanguard_daily_aggregates')
        .select(`date, ${rec.related_metric}`)
        .eq('user_id', userId)
        .gte('date', startStr)
        .lte('date', endStr),
      supabase
        .from('vanguard_daily_aggregates')
        .select(`date, ${rec.related_metric}`)
        .eq('user_id', userId)
        .gte('date', baselineStartStr)
        .lte('date', baselineEndStr)
    ]);

    const actualRows = actualRes.data || [];
    const baselineRows = baselineRes.data || [];

    // Filter out nulls
    const actualValues = actualRows
      .map((r: any) => r[rec.related_metric])
      .filter((val): val is number => val !== null && val !== undefined);

    const baselineValues = baselineRows
      .map((r: any) => r[rec.related_metric])
      .filter((val): val is number => val !== null && val !== undefined);

    // Minimum data requirement: at least half of the evaluation days must have data
    const minDaysRequired = Math.ceil(rec.evaluation_window_days / 2);
    if (actualValues.length < minDaysRequired) {
      console.warn(`[recommendations] Insufficient data for recommendation ${rec.id}. Found ${actualValues.length}/${rec.evaluation_window_days} days.`);
      
      await supabase
        .from('oracle_recommendations')
        .update({
          status: 'evaluated',
          outcome: 'no_data',
          actual_value: null,
          baseline_value: baselineValues.length > 0 ? (baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length) : null,
          evaluated_at: new Date().toISOString()
        })
        .eq('id', rec.id);

      resolved++;
      no_data++;
      continue;
    }

    const actualAvg = actualValues.reduce((sum, val) => sum + val, 0) / actualValues.length;
    const baselineAvg = baselineValues.length > 0
      ? (baselineValues.reduce((sum, val) => sum + val, 0) / baselineValues.length)
      : null;

    // Evaluate success condition
    let isSuccess = false;
    if (rec.success_threshold !== null && rec.success_threshold !== undefined) {
      isSuccess = actualAvg >= rec.success_threshold;
    } else if (baselineAvg !== null) {
      isSuccess = actualAvg > baselineAvg;
    } else {
      isSuccess = true; // fallback if no baseline and no threshold
    }

    const outcome = isSuccess ? 'success' : 'fail';
    
    await supabase
      .from('oracle_recommendations')
      .update({
        status: 'evaluated',
        outcome,
        actual_value: actualAvg,
        baseline_value: baselineAvg,
        evaluated_at: new Date().toISOString()
      })
      .eq('id', rec.id);

    resolved++;
    if (isSuccess) successes++;
    else fails++;

    console.log(`[recommendations] Evaluated recommendation ${rec.id} -> ${outcome}. Baseline: ${baselineAvg?.toFixed(2) ?? 'N/A'}, Actual: ${actualAvg.toFixed(2)}`);
  }

  return { resolved, successes, fails, no_data };
}
