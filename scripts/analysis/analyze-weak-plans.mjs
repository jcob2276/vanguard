#!/usr/bin/env node
/**
 * analyze-weak-plans.mjs
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/analysis/analyze-weak-plans.mjs
 *
 * Purpose:
 *   Inspect current state of weak / low-quality plans in daily_reconciliations
 *   before running the backfill migration.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  console.log('=== Weak Plan Analysis ===\n');

  // 1. Overall plan_quality distribution
  const { data: qualityDist } = await supabase
    .from('daily_reconciliations')
    .select('plan_quality, plan_failure_reason')
    .order('created_at', { ascending: false });

  const qualityCounts = {};
  qualityDist?.forEach(row => {
    const key = `${row.plan_quality || 'NULL'}|${row.plan_failure_reason || 'none'}`;
    qualityCounts[key] = (qualityCounts[key] || 0) + 1;
  });

  console.log('Current plan_quality distribution:');
  Object.entries(qualityCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, count]) => console.log(`  ${k}: ${count}`));

  console.log('\n---');

  // 2. Rows that would be touched by the migration
  const { data: parseErrorRows } = await supabase
    .from('daily_reconciliations')
    .select('id, date, plan_quality')
    .eq('parse_error', true)
    .or('plan_quality.is.null,plan_quality.eq.good')
    .order('date', { ascending: false });

  console.log(`\nRows with parse_error=true that would get plan_quality='minimum': ${parseErrorRows?.length || 0}`);

  const { data: fallbackRows } = await supabase
    .from('daily_reconciliations')
    .select('id, date')
    .eq('plan_fallback', true)
    .is('plan_quality', null);

  console.log(`Rows with plan_fallback=true and no plan_quality: ${fallbackRows?.length || 0}`);

  const { data: rescueRows } = await supabase
    .from('daily_reconciliations')
    .select('id, date')
    .eq('mode', 'rescue')
    .or('plan_quality.is.null,plan_quality.eq.good');

  console.log(`Rescue mode rows without proper plan_quality: ${rescueRows?.length || 0}`);

  // 3. Sample of the worst offenders (for manual review)
  console.log('\n--- Sample of potentially very weak recent plans ---');
  const { data: weakSamples } = await supabase
    .from('daily_reconciliations')
    .select('id, date, mode, plan_quality, plan_failure_reason, planning_summary')
    .or('parse_error.eq.true,plan_fallback.eq.true,mode.eq.rescue')
    .order('date', { ascending: false })
    .limit(8);

  weakSamples?.forEach(row => {
    const summary = row.planning_summary || {};
    console.log(`\n${row.date} | mode=${row.mode} | quality=${row.plan_quality || 'NULL'} | failure=${row.plan_failure_reason || 'none'}`);
    console.log(`  artifact: ${summary.production_artifact?.artifact || summary.one_clear_move || '—'}`);
    console.log(`  id: ${row.id}`);
  });

  console.log('\n=== End of analysis ===');
  console.log('Next step: Apply the migration 20260529000001_backfill_plan_quality_flags.sql');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
