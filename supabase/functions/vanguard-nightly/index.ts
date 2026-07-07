import { corsHeaders, createServiceClient } from '../_shared/supabase.ts';
import { runSaveDailyAggregate } from '../_shared/nightly/aggregate.ts';
import { runComputeDailyStrain } from '../_shared/nightly/metrics_strain.ts';
import { runComputeIllnessSignal } from '../_shared/nightly/metrics_illness.ts';
import { runComputeRecoveryForecast } from '../_shared/nightly/metrics_recovery.ts';
import { runDetectPatterns } from '../_shared/nightly/patterns.ts';
import { runPatternOutcomes } from '../_shared/nightly/outcomes.ts';
import { runComputeCorrelations } from '../_shared/nightly/correlations.ts';
import { fetchWorldState, saveWorldState } from '../_shared/worldState.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[vanguard-nightly] Starting unified nightly pipeline...');

  try {
    const supabase = createServiceClient();
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const userId: string = body.userId;
    if (!userId) throw new Error('Missing userId in request body');

    const todayStr = body.date || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
    const yesterdayStr = (() => {
      const d = new Date(todayStr + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().split('T')[0];
    })();

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

    if (freshnessWarnings.length > 0) {
      console.warn('[vanguard-nightly] Ingest freshness warning:', freshnessWarnings.join(', '));
    } else {
      console.log('[vanguard-nightly] Ingest freshness check OK');
    }

    // 2. save-daily-aggregate
    console.log('[vanguard-nightly] Step 2: save-daily-aggregate');
    const aggRes = await runSaveDailyAggregate(new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify({ userId, date: todayStr })
    }));
    if (!aggRes.ok) console.error('[vanguard-nightly] aggregate failed');

    // 3. compute-daily-strain, illness-signal, recovery-forecast
    console.log('[vanguard-nightly] Step 3: compute metrics');
    const metricRequest = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({ userId, date: todayStr })
    });
    await runComputeDailyStrain(metricRequest).catch(e => console.error(e));
    await runComputeIllnessSignal(metricRequest).catch(e => console.error(e));
    await runComputeRecoveryForecast(metricRequest).catch(e => console.error(e));

    // 4. vanguard-detect-patterns
    console.log('[vanguard-nightly] Step 4: detect-patterns');
    await runDetectPatterns(metricRequest).catch(e => console.error(e));

    // 5. pattern-outcomes
    console.log('[vanguard-nightly] Step 5: pattern-outcomes');
    await runPatternOutcomes().catch(e => console.error(e));

    // 6. correlations
    console.log('[vanguard-nightly] Step 6: correlations');
    await runComputeCorrelations(metricRequest).catch(e => console.error(e));

    // 7. Cache World State
    console.log('[vanguard-nightly] Step 7: caching world state');
    const ws = await fetchWorldState(supabase, userId, todayStr);
    await saveWorldState(supabase, userId, todayStr, ws);

    console.log('[vanguard-nightly] Pipeline finished successfully.');
    return new Response(JSON.stringify({ 
      success: true, 
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
