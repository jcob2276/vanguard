-- =============================================================
-- RLS audit 2026-06-11: 4 tabele bez Row Level Security
-- Znalezione przez Supabase security advisor:
--   daily_reconciliations, strava_activities, strava_tokens,
--   training_plan_workouts
-- Wzorzec: 20260519000002_rls_missing_tables.sql
-- Edge functions używają service_role (bypass) — bez wpływu.
-- Frontend czyta tylko strava_activities (Stats, StravaWidget).
-- =============================================================

-- ---- 1. daily_reconciliations (backend-only, ma user_id) ----
ALTER TABLE public.daily_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own reconciliations"
  ON public.daily_reconciliations FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Service role bypass reconciliations"
  ON public.daily_reconciliations FOR ALL TO service_role
  USING (true);

-- ---- 2. strava_activities (frontend read: Stats, StravaWidget) ----
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own strava activities"
  ON public.strava_activities FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Service role bypass strava_activities"
  ON public.strava_activities FOR ALL TO service_role
  USING (true);

-- ---- 3. strava_tokens (OAuth tokeny — TYLKO service role) ----
-- Celowo BRAK polityki dla authenticated: tokeny nie mogą być
-- czytelne z przeglądarki nawet dla właściciela (XSS blast radius).
-- Używa ich wyłącznie sync-strava przez createServiceClient().
ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only strava_tokens"
  ON public.strava_tokens FOR ALL TO service_role
  USING (true);

-- ---- 4. training_plan_workouts (backend-only, ma user_id) ----
ALTER TABLE public.training_plan_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own training plan"
  ON public.training_plan_workouts FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Service role bypass training_plan"
  ON public.training_plan_workouts FOR ALL TO service_role
  USING (true);
