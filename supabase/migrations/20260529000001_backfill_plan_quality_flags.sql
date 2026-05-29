-- ============================================================================
-- DATA HYGIENE: Backfill plan_quality + plan_failure_reason
-- Date: 2026-05-29
--
-- Purpose:
--   Make historical weak plans visible to morning-brief, midday-check,
--   reconciliation, Oracle, and future analytics.
--
-- SAFETY:
--   - All updates are guarded (only touch rows where plan_quality is NULL or 'good')
--   - Idempotent — safe to run multiple times
--   - Run the PREVIEW QUERIES below first to see impact
-- ============================================================================

-- 0. Ensure columns exist on daily_reconciliations
ALTER TABLE public.daily_reconciliations
  ADD COLUMN IF NOT EXISTS plan_quality text,
  ADD COLUMN IF NOT EXISTS plan_failure_reason text;

-- ----------------------------------------------------------------------------
-- PREVIEW QUERIES (run these first to see what will be affected)
-- Even better: run `node scripts/analyze-weak-plans.mjs` (with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
-- ----------------------------------------------------------------------------
-- SELECT COUNT(*) FILTER (WHERE parse_error = true AND (plan_quality IS NULL OR plan_quality = 'good')) AS parse_error_count FROM daily_reconciliations;
-- SELECT COUNT(*) FILTER (WHERE plan_fallback = true AND plan_quality IS NULL) AS fallback_count FROM daily_reconciliations;
-- SELECT COUNT(*) FILTER (WHERE mode = 'rescue' AND (plan_quality IS NULL OR plan_quality = 'good')) AS rescue_count FROM daily_reconciliations;
-- SELECT COUNT(*) AS very_minimal_count FROM daily_reconciliations
-- WHERE plan_quality IS NULL
--   AND planning_summary->>'one_clear_move' LIKE 'Zdefiniuj%'
--   AND (planning_summary->'production_artifact'->>'artifact' LIKE 'Podstawowy%' OR planning_summary->'production_artifact'->>'minimum_version' LIKE 'Nagraj%');

-- ----------------------------------------------------------------------------
-- 1. Explicit parse failures
-- ----------------------------------------------------------------------------
UPDATE daily_reconciliations
SET 
  plan_quality = 'minimum',
  plan_failure_reason = 'parse_failed'
WHERE (planning_summary->>'parse_error')::boolean = true
  AND (plan_quality IS NULL OR plan_quality = 'good');

-- ----------------------------------------------------------------------------
-- 2. Explicit fallbacks from createMinimumViablePlan / createFallbackPlan
-- ----------------------------------------------------------------------------
UPDATE daily_reconciliations
SET 
  plan_quality = COALESCE(plan_quality, 'minimum'),
  plan_failure_reason = COALESCE(plan_failure_reason, 'llm_fallback')
WHERE (planning_summary->>'plan_fallback')::boolean = true
  AND plan_quality IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Rescue mode plans that never received a proper quality flag
-- ----------------------------------------------------------------------------
UPDATE daily_reconciliations
SET plan_quality = 'rescue'
WHERE mode = 'rescue'
  AND (plan_quality IS NULL OR plan_quality = 'good');

-- ----------------------------------------------------------------------------
-- 4. Very obviously incomplete/minimal plans (text matches default placeholders)
-- ----------------------------------------------------------------------------
UPDATE daily_reconciliations
SET 
  plan_quality = 'minimum',
  plan_failure_reason = COALESCE(plan_failure_reason, 'incomplete')
WHERE plan_quality IS NULL
  AND planning_summary->>'one_clear_move' LIKE 'Zdefiniuj%'
  AND (
    planning_summary->'production_artifact'->>'artifact' LIKE 'Podstawowy%' 
    OR planning_summary->'production_artifact'->>'minimum_version' LIKE 'Nagraj%'
  );

-- ----------------------------------------------------------------------------
-- POST-MIGRATION VERIFICATION (recommended)
-- ----------------------------------------------------------------------------
-- SELECT plan_quality, plan_failure_reason, COUNT(*) 
-- FROM daily_reconciliations 
-- GROUP BY plan_quality, plan_failure_reason 
-- ORDER BY COUNT(*) DESC;

-- Note: 
-- This is a one-time historical cleanup.
-- All new plans (after May 2026) should be written with explicit 
-- plan_quality + plan_failure_reason from the code (planning.ts, morningRescue.ts, createFallbackPlan).
