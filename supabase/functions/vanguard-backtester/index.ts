/**
 * @function vanguard-backtester
 * @trigger HTTP POST / manual (wymaga Service Role Key)
 * @role Backtesting reguł i wzorców na historycznych danych biometrycznych/żywieniowych.
 * @reads daily_strain, oura_daily_summary, daily_nutrition
 * @writes —
 * @calls —
 * @consumer Narzędzia deweloperskie i analityczne
 * @status active
 */
import { corsHeaders, createServiceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Authorize via Service Role Key
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const serviceRoleKey = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  
  if (!serviceRoleKey || token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const supabase = createServiceClient();
    const body = await req.json().catch(() => ({}));
    
    const userId = body.userId;
    if (!userId) throw new Error("Missing userId in request body");

    const startDateStr = body.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDateStr = body.endDate || new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const runSimulation = body.runSimulation ?? true;

    console.log(`[backtester] Starting backtest for user ${userId} from ${startDateStr} to ${endDateStr}`);

    // Generate date sequence
    const dates: string[] = [];
    const current = new Date(startDateStr + 'T12:00:00Z');
    const end = new Date(endDateStr + 'T12:00:00Z');
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setUTCDate(current.getUTCDate() + 1);
    }

    // 2. Fetch all daily aggregates for actual comparisons
    const { data: aggregates, error: aggErr } = await supabase
      .from('vanguard_daily_aggregates')
      .select('date, sleep_hours, readiness_score, execution_score')
      .eq('user_id', userId)
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (aggErr) throw aggErr;
    const aggMap = new Map(aggregates?.map(r => [r.date, r]) || []);

    // 3. Historical Evaluation (from existing DB records)
    const { data: historicalPreds, error: predErr } = await supabase
      .from('vanguard_predictions')
      .select('prediction_date, metric, predicted_value, actual_value, error_value, status, prediction_type')
      .eq('user_id', userId)
      .gte('prediction_date', startDateStr)
      .lte('prediction_date', endDateStr);

    if (predErr) throw predErr;

    // Calculate historical stats
    const histStats = calculatePredictionStats(historicalPreds || []);

    // 4. Recommendations Evaluation
    const { data: recommendations, error: recErr } = await supabase
      .from('oracle_recommendations')
      .select('id, created_at, related_metric, success_threshold, evaluation_window_days, status, outcome, actual_value, baseline_value')
      .eq('user_id', userId)
      .gte('created_at', startDateStr)
      .lte('created_at', endDateStr + 'T23:59:59Z');

    if (recErr) throw recErr;

    const recStats = calculateRecommendationStats(recommendations || []);

    // 5. Simulation Evaluation (optional on-the-fly execution)
    let simulatedStats = null;
    if (runSimulation) {
      simulatedStats = await runPredictionSimulation(supabase, userId, dates, aggMap);
    }

    return new Response(JSON.stringify({
      success: true,
      period: { startDate: startDateStr, endDate: endDateStr, totalDays: dates.length },
      historicalPredictions: histStats,
      recommendations: recStats,
      simulation: simulatedStats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[backtester] Execution failed:', err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function calculatePredictionStats(preds: any[]) {
  const stats: Record<string, { count: number; resolvedCount: number; mae?: number; brier?: number }> = {};

  for (const p of preds) {
    const key = `${p.prediction_type}:${p.metric}`;
    if (!stats[key]) {
      stats[key] = { count: 0, resolvedCount: 0 };
    }
    stats[key].count++;

    if (p.status === 'resolved' && p.actual_value !== null) {
      stats[key].resolvedCount++;
      const diff = Math.abs(p.predicted_value - p.actual_value);
      
      if (p.prediction_type === 'metric') {
        // Continuous MAE calculation
        if (stats[key].mae === undefined) stats[key].mae = 0;
        stats[key].mae! += diff;
      } else {
        // Binary/Probability Brier score: (predicted - actual)^2
        const brierTerm = Math.pow(p.predicted_value - p.actual_value, 2);
        if (stats[key].brier === undefined) stats[key].brier = 0;
        stats[key].brier! += brierTerm;
      }
    }
  }

  // Average the accumulated error values
  for (const key of Object.keys(stats)) {
    const s = stats[key];
    if (s.resolvedCount > 0) {
      if (s.mae !== undefined) {
        s.mae = parseFloat((s.mae / s.resolvedCount).toFixed(3));
      }
      if (s.brier !== undefined) {
        s.brier = parseFloat((s.brier / s.resolvedCount).toFixed(4));
      }
    }
  }

  return stats;
}

function calculateRecommendationStats(recs: any[]) {
  let total = recs.length;
  let evaluated = 0;
  let successes = 0;
  let fails = 0;
  let no_data = 0;

  for (const r of recs) {
    if (r.status === 'evaluated') {
      evaluated++;
      if (r.outcome === 'success') successes++;
      else if (r.outcome === 'fail') fails++;
      else if (r.outcome === 'no_data') no_data++;
    }
  }

  const successRate = (successes + fails) > 0 ? parseFloat((successes / (successes + fails)).toFixed(3)) : null;

  return {
    total,
    evaluated,
    successes,
    fails,
    no_data,
    success_rate: successRate
  };
}

async function runPredictionSimulation(
  supabase: any,
  userId: string,
  dates: string[],
  aggMap: Map<string, any>
) {
  // We need to fetch the historical daily aggregates prior to startDate to seed the first predictions
  const firstDate = dates[0];
  const { data: seedHistory, error: seedErr } = await supabase
    .from('vanguard_daily_aggregates')
    .select('date, sleep_hours, readiness_score, execution_score')
    .eq('user_id', userId)
    .lt('date', firstDate)
    .order('date', { ascending: false })
    .limit(7);

  if (seedErr) throw seedErr;

  // Combine seed history and evaluation period history to allow sliding-window retrieval
  const allAggregates = [...(seedHistory || [])];
  
  // We'll also fetch the evaluation range data
  const { data: evalHistory, error: evalHistoryErr } = await supabase
    .from('vanguard_daily_aggregates')
    .select('date, sleep_hours, readiness_score, execution_score')
    .eq('user_id', userId)
    .gte('date', firstDate)
    .lte('date', dates[dates.length - 1])
    .order('date', { ascending: false });

  if (evalHistoryErr) throw evalHistoryErr;
  allAggregates.push(...(evalHistory || []));

  // Sort descending by date
  allAggregates.sort((a, b) => b.date.localeCompare(a.date));

  const metrics = ['sleep_hours', 'readiness_score', 'execution_score'] as const;
  const defaultValues = {
    sleep_hours: 7.5,
    readiness_score: 75.0,
    execution_score: 0.65
  };

  const simulationErrors: Record<string, { sumError: number; count: number }> = {
    sleep_hours: { sumError: 0, count: 0 },
    readiness_score: { sumError: 0, count: 0 },
    execution_score: { sumError: 0, count: 0 }
  };

  for (const targetDate of dates) {
    const actualRow = aggMap.get(targetDate);
    if (!actualRow) continue;

    // Filter aggregates strictly < targetDate
    const historyBefore = allAggregates.filter(row => row.date < targetDate).slice(0, 7);

    for (const metric of metrics) {
      const actualVal = actualRow[metric];
      if (actualVal === null || actualVal === undefined) continue;

      let predictedValue = defaultValues[metric];
      if (historyBefore.length > 0) {
        let sumValues = 0;
        let sumWeights = 0;
        historyBefore.forEach((row: any, idx: number) => {
          const val = row[metric];
          if (val != null) {
            // Im świeższy dzień, tym większa waga
            const weight = 7 - idx;
            sumValues += val * weight;
            sumWeights += weight;
          }
        });
        if (sumWeights > 0) {
          predictedValue = parseFloat((sumValues / sumWeights).toFixed(2));
        }
      }

      const error = Math.abs(predictedValue - actualVal);
      simulationErrors[metric].sumError += error;
      simulationErrors[metric].count++;
    }
  }

  const results: Record<string, { mae: number | null; count: number }> = {};
  for (const metric of metrics) {
    const errObj = simulationErrors[metric];
    results[metric] = {
      mae: errObj.count > 0 ? parseFloat((errObj.sumError / errObj.count).toFixed(3)) : null,
      count: errObj.count
    };
  }

  return results;
}
