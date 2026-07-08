-- ============================================================
-- VANGUARD OS — ADD ALGO VERSION COLUMN FOR DERIVED METRICS
-- ============================================================

-- Add algo_version to daily_strain
ALTER TABLE public.daily_strain 
  ADD COLUMN IF NOT EXISTS algo_version int DEFAULT 1;

-- Add algo_version to vanguard_daily_aggregates
ALTER TABLE public.vanguard_daily_aggregates 
  ADD COLUMN IF NOT EXISTS algo_version int DEFAULT 1;
