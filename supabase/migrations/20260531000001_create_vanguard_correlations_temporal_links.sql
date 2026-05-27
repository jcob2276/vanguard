-- ============================================================================
-- CREATE vanguard_correlations + vanguard_temporal_links
-- Date: 2026-05-31
--
-- These tables were referenced in vanguardCore.ts (computePredictions,
-- analyzeInterventions) and had RLS enabled in mig. 20260514000008 via
-- ALTER TABLE IF EXISTS — meaning they never existed on a fresh deploy.
--
-- Safe to run multiple times (CREATE ... IF NOT EXISTS).
-- ============================================================================

-- ─── vanguard_correlations ──────────────────────────────────────────────────
-- Stores signal↔execution correlations for computePredictions().
-- Computed externally (save-daily-aggregate or future analysis function)
-- and read by VanguardCore to weight risk predictions.

CREATE TABLE IF NOT EXISTS public.vanguard_correlations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_name   text        NOT NULL,   -- 'sleep' | 'fragmentation' | 'dopamine' | 'hrv' | 'execution'
  r_value       float       NOT NULL,   -- Pearson r; range -1..1
  sample_count  integer,                -- how many days were used
  computed_at   timestamptz NOT NULL DEFAULT now(),
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Only one correlation row per user × signal at a time (upsert pattern).
-- Caller should ON CONFLICT (user_id, signal_name) DO UPDATE.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vanguard_correlations_user_signal
  ON public.vanguard_correlations (user_id, signal_name);

CREATE INDEX IF NOT EXISTS idx_vanguard_correlations_user
  ON public.vanguard_correlations (user_id);

ALTER TABLE public.vanguard_correlations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own correlations" ON public.vanguard_correlations;
CREATE POLICY "Users can manage own correlations"
  ON public.vanguard_correlations
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.vanguard_correlations IS
  'Signal↔execution correlations per user. Read by VanguardCore.computePredictions(). '
  'Written by save-daily-aggregate or any analytics function. '
  'Upsert on (user_id, signal_name).';

-- ─── vanguard_temporal_links ────────────────────────────────────────────────
-- Stores cause→effect links between past interventions and biometric outcomes.
-- Written by VanguardCore.analyzeInterventions().
-- Used to surface "this helped" patterns in weekly review.

CREATE TABLE IF NOT EXISTS public.vanguard_temporal_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_date   date        NOT NULL,   -- date of the intervention
  target_date   date        NOT NULL,   -- date the effect was observed
  link_type     text        NOT NULL,   -- 'RECOVERY' | 'DECLINE' | 'NEUTRAL'
  description   text,                  -- human-readable e.g. "Early sleep → +8ms HRV"
  strength      float       NOT NULL DEFAULT 0.5  CHECK (strength >= 0 AND strength <= 1),
  metadata      jsonb,                 -- hrv_delta, sleep_delta, intervention_text …
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate links for the same source→target pair.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vanguard_temporal_links_pair
  ON public.vanguard_temporal_links (user_id, source_date, target_date);

CREATE INDEX IF NOT EXISTS idx_vanguard_temporal_links_user_target
  ON public.vanguard_temporal_links (user_id, target_date DESC);

ALTER TABLE public.vanguard_temporal_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own temporal links" ON public.vanguard_temporal_links;
CREATE POLICY "Users can manage own temporal links"
  ON public.vanguard_temporal_links
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.vanguard_temporal_links IS
  'Cause→effect temporal links between past interventions (daily_wins.is_intervention=true) '
  'and subsequent biometric outcomes (HRV delta, sleep delta). '
  'Written by VanguardCore.analyzeInterventions(). Unique on (user_id, source_date, target_date).';
