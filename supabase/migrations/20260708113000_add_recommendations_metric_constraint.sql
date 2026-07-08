-- ============================================================
-- VANGUARD OS — FAZA 2: ADD CONSTRAINT ON RELATED_METRIC
-- ============================================================

ALTER TABLE public.oracle_recommendations
  ADD CONSTRAINT check_related_metric 
  CHECK (related_metric IN ('sleep_hours', 'readiness_score', 'execution_score'));
