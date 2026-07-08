-- ============================================================
-- VANGUARD OS — ADD OUTCOME METRIC TO BEHAVIORAL PATTERNS
-- ============================================================

ALTER TABLE public.vanguard_behavioral_patterns 
ADD COLUMN IF NOT EXISTS outcome_metric text;

COMMENT ON COLUMN public.vanguard_behavioral_patterns.outcome_metric 
IS 'Name of the metric used to measure outcome success for this pattern (e.g. sleep_hours, readiness_score, execution_score). Defaults to execution_score if NULL.';
