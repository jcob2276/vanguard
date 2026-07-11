/**
 * @function vanguard-nightly
 * @trigger pg_cron `0 20 * * *` UTC (lub manualny HTTP POST / `?action=` z resolveUserScope)
 * @role Nightly Job Orchestrator: koordynuje wszystkie nocne agregacje, strain, korelacje, prognozy.
 * @reads daily_strain, oura_daily_summary, daily_nutrition, exercise_logs, behavior_log
 * @writes vanguard_daily_aggregates, daily_strain, audit_events, world_state, vanguard_pipeline_runs
 * @calls —
 * @consumer Zaktualizowany stan świata i korelacje w aplikacji i Wyroczni
 * @status active
 */
import { corsHeaders, createServiceClient, resolveUserScope } from '../_shared/supabase.ts';
import { requireServiceRole } from '../_shared/auth.ts';
import { runSaveDailyAggregate } from '../_shared/nightly/aggregate.ts';
import { runComputeDailyStrain } from '../_shared/nightly/metrics_strain.ts';
import { runComputeIllnessSignal } from '../_shared/nightly/metrics_illness.ts';
import { runComputeRecoveryForecast } from '../_shared/nightly/metrics_recovery.ts';
import { runDetectPatterns } from '../_shared/nightly/patterns.ts';
import { runPatternOutcomes } from '../_shared/nightly/outcomes.ts';
import { runComputeCorrelations } from '../_shared/nightly/correlations.ts';
import { fetchWorldState, saveWorldState } from '../_shared/worldState.ts';
import { resolvePastPredictions, generateTomorrowPredictions } from '../_shared/nightly/predictions.ts';
import { resolveOracleRecommendations } from '../_shared/nightly/recommendations.ts';
import { runRescoreWorkoutSessions, runRescoreWorkoutSessionsInternal } from '../_shared/nightly/rescore.ts';
import { runGraphInvariantCheck } from '../_shared/nightly/graphInvariants.ts';

async function runLedgerStep(
  supabase: any,
  userId: string,
  runId: string,
  stepName: string,
  critical: boolean,
  stepFn: () => Promise<any>
) {
  const startedAt = new Date();
  console.log(`[vanguard-nightly] Executing step: ${stepName}...`);
  try {
    const result = await stepFn();
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    
    await supabase.from('vanguard_pipeline_runs').insert({
      user_id: userId,
      run_id: runId,
      step_name: stepName,
      status: 'ok',
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs
    });
    return result;
  } catch (error: any) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    console.error(`[vanguard-nightly] Step ${stepName} failed:`, error);
    
    await supabase.from('vanguard_pipeline_runs').insert({
      user_id: userId,
      run_id: runId,
      step_name: stepName,
      status: 'error',
      error_message: error.message || String(error),
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs
    });
    
    if (critical) {
      throw error;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || body.action;

    if (action) {
      // Actions accept both service-role and user tokens
      let scope;
      try {
        scope = await resolveUserScope(req, body.userId ?? null);
      } catch (e) {
        return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const reqForSub = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(body)
      });

      switch (action) {
        case 'compute-daily-strain':
          return await runComputeDailyStrain(reqForSub);
        case 'detect-patterns':
          return await runDetectPatterns(reqForSub);
        case 'compute-correlations':
          return await runComputeCorrelations(reqForSub);
        case 'rescore-workout-sessions':
          return await runRescoreWorkoutSessions(reqForSub);
        default:
          return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
    }

    // Full pipeline requires service-role
    const authError = requireServiceRole(req);
    if (authError) return authError;

    console.log('[vanguard-nightly] Starting unified nightly pipeline...');

    const userId: string = body.userId;
    if (!userId) throw new Error('Missing userId in request body');

    const todayStr = body.date || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
    const yesterdayStr = (() => {
      const d = new Date(todayStr + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().split('T')[0];
    })();

    const runId = crypto.randomUUID();

    // 1. Freshness Check
    console.log('[vanguard-nightly] Step 1: Freshness Check');
    const [{ data: ouraFresh }, { data: nutrFresh }] = await Promise.all([
      supabase.from('oura_daily_summary').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_nutrition').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const ouraIsFresh = ouraFresh && (ouraFresh.date === todayStr || ouraFresh.date === yesterdayStr);
    const nutritionIsFresh = nutrFresh && (nutrFresh.date === todayStr || nutrFresh.date === yesterdayStr);
    
    const freshnessWarnings: string[] = [];
    if (!ouraIsFresh) freshnessWarnings.push('Oura sleep data is not fresh');
    if (!nutritionIsFresh) freshnessWarnings.push('Nutrition log is not fresh');

    // 2. save-daily-aggregate (today + finalize yesterday)
    await runLedgerStep(supabase, userId, runId, 'save-daily-aggregate', true, async () => {
      const aggRes = await runSaveDailyAggregate(new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify({ userId, date: todayStr })
      }));
      if (!aggRes.ok) throw new Error(`Aggregate (today) failed: ${aggRes.status}`);

      const aggYesterdayRes = await runSaveDailyAggregate(new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify({ userId, date: yesterdayStr })
      }));
      if (!aggYesterdayRes.ok) throw new Error(`Aggregate (yesterday finalize) failed: ${aggYesterdayRes.status}`);
    });

    // 2.5 resolve past predictions
    await runLedgerStep(supabase, userId, runId, 'resolve-past-predictions', false, async () => {
      await resolvePastPredictions(supabase, userId, todayStr);
    });

    // 2.7 resolve oracle recommendations
    await runLedgerStep(supabase, userId, runId, 'resolve-oracle-recommendations', false, async () => {
      await resolveOracleRecommendations(supabase, userId, todayStr);
    });

    // 2.9 rescore-workout-sessions (before daily strain calculation)
    await runLedgerStep(supabase, userId, runId, 'rescore-workout-sessions', false, async () => {
      await runRescoreWorkoutSessionsInternal(supabase, userId, 3);
    });

    // 3. compute metrics
    const metricRequest = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({
        userId,
        date: todayStr,
        dateFrom: body.dateFrom ?? null,
        dateTo: body.dateTo ?? null,
        algoVersion: body.algoVersion ?? 1
      })
    });
    await runLedgerStep(supabase, userId, runId, 'compute-daily-strain', true, async () => {
      await runComputeDailyStrain(metricRequest);
    });
    await runLedgerStep(supabase, userId, runId, 'compute-illness-signal', true, async () => {
      await runComputeIllnessSignal(metricRequest);
    });
    await runLedgerStep(supabase, userId, runId, 'compute-recovery-forecast', true, async () => {
      await runComputeRecoveryForecast(metricRequest);
    });

    // 4. vanguard-detect-patterns
    await runLedgerStep(supabase, userId, runId, 'detect-patterns', false, async () => {
      await runDetectPatterns(metricRequest);
    });

    // 5. pattern-outcomes
    await runLedgerStep(supabase, userId, runId, 'pattern-outcomes', false, async () => {
      await runPatternOutcomes();
    });

    // 6. correlations
    await runLedgerStep(supabase, userId, runId, 'compute-correlations', false, async () => {
      await runComputeCorrelations(metricRequest);
    });

    // 7. Cache World State
    let ws: any;
    await runLedgerStep(supabase, userId, runId, 'cache-world-state', true, async () => {
      ws = await fetchWorldState(supabase, userId, todayStr);
      await saveWorldState(supabase, userId, todayStr, ws);
    });

    // 7.5 generate tomorrow predictions
    await runLedgerStep(supabase, userId, runId, 'generate-tomorrow-predictions', false, async () => {
      await generateTomorrowPredictions(supabase, userId, todayStr);
    });

    // 8. graph invariant check (non-critical, audit-only)
    await runLedgerStep(supabase, userId, runId, 'graph-invariants', false, async () => {
      const violations = await runGraphInvariantCheck(supabase, userId);
      if (violations.length > 0) {
        console.warn(`[vanguard-nightly] Graph invariant violations: ${violations.length}`);
      }
      return { violations: violations.length };
    });

    console.log('[vanguard-nightly] Pipeline finished successfully.');
    return new Response(JSON.stringify({ 
      success: true, 
      run_id: runId,
      freshness: {
        oura_fresh: !!ouraIsFresh,
        nutrition_fresh: !!nutritionIsFresh,
        warnings: freshnessWarnings
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[vanguard-nightly] Pipeline fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
