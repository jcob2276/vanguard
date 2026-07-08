-- ============================================================
-- VANGUARD OS — FAZA 2: LEDGER RUNS & RECOMMENDATIONS
-- ============================================================

-- 1. Table vanguard_pipeline_runs
CREATE TABLE IF NOT EXISTS public.vanguard_pipeline_runs (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id uuid NOT NULL, -- grouped nightly run id
  step_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'error', 'skipped')),
  error_message text,
  started_at timestamp with time zone NOT NULL,
  finished_at timestamp with time zone NOT NULL,
  duration_ms integer NOT NULL
);

ALTER TABLE public.vanguard_pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own pipeline runs" ON public.vanguard_pipeline_runs
  USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.vanguard_pipeline_runs TO authenticated;
GRANT ALL ON TABLE public.vanguard_pipeline_runs TO service_role;

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_user_run ON public.vanguard_pipeline_runs (user_id, run_id);


-- 2. Table oracle_recommendations
CREATE TABLE IF NOT EXISTS public.oracle_recommendations (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  oracle_run_id uuid REFERENCES public.vanguard_oracle_runs(id) ON DELETE SET NULL,
  recommendation_text text NOT NULL,
  related_metric text NOT NULL,
  success_threshold double precision, -- target value (e.g. >= 8.0) or relative increase
  evaluation_window_days integer DEFAULT 7 NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'evaluated')),
  outcome text CHECK (outcome IN ('success', 'fail', 'inconclusive', 'no_data')),
  baseline_value double precision,
  actual_value double precision,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  evaluated_at timestamp with time zone
);

ALTER TABLE public.oracle_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own recommendations" ON public.oracle_recommendations
  USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.oracle_recommendations TO authenticated;
GRANT ALL ON TABLE public.oracle_recommendations TO service_role;

CREATE INDEX IF NOT EXISTS idx_recommendations_user_status ON public.oracle_recommendations (user_id, status);
