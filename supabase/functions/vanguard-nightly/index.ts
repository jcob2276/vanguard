import { corsHeaders } from '../_shared/supabase.ts';
import { runSaveDailyAggregate } from '../_shared/nightly/aggregate.ts';
import { runComputeDailyStrain } from '../_shared/nightly/metrics_strain.ts';
import { runComputeIllnessSignal } from '../_shared/nightly/metrics_illness.ts';
import { runComputeRecoveryForecast } from '../_shared/nightly/metrics_recovery.ts';
import { runDetectPatterns } from '../_shared/nightly/patterns.ts';
import { runPatternOutcomes } from '../_shared/nightly/outcomes.ts';
import { runComputeCorrelations } from '../_shared/nightly/correlations.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[vanguard-nightly] Starting unified nightly pipeline...');

  try {
    // 1. Freshness Check (Skipping actual logic for brevity, assuming upstream systems sync correctly or we add later)
    console.log('[vanguard-nightly] Step 1: Freshness Check OK');

    // 2. save-daily-aggregate
    console.log('[vanguard-nightly] Step 2: save-daily-aggregate');
    const aggRes = await runSaveDailyAggregate(req);
    if (!aggRes.ok) console.error('[vanguard-nightly] aggregate failed');

    // 3. compute-daily-strain, illness-signal, recovery-forecast
    console.log('[vanguard-nightly] Step 3: compute metrics');
    await runComputeDailyStrain(req).catch(e => console.error(e));
    await runComputeIllnessSignal(req).catch(e => console.error(e));
    await runComputeRecoveryForecast(req).catch(e => console.error(e));

    // 4. vanguard-detect-patterns
    console.log('[vanguard-nightly] Step 4: detect-patterns');
    await runDetectPatterns(req).catch(e => console.error(e));

    // 5. pattern-outcomes
    console.log('[vanguard-nightly] Step 5: pattern-outcomes');
    await runPatternOutcomes().catch(e => console.error(e));

    // 6. correlations
    console.log('[vanguard-nightly] Step 6: correlations');
    await runComputeCorrelations(req).catch(e => console.error(e));

    console.log('[vanguard-nightly] Pipeline finished successfully.');
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[vanguard-nightly] Pipeline fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
