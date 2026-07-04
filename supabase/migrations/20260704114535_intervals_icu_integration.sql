-- =============================================================
-- Strava API przeszła na płatną subskrypcję (Application Inactive,
-- 403 na każdy request) — patrz lessons.md 2026-07-04.
-- Zastępujemy sync-strava synchronizacją z intervals.icu, który ma
-- darmowe, oficjalne (OAuth) połączenie z Garmin Connect i otwarte API
-- (Basic Auth, statyczny klucz, bez rotacji tokenów jak przy Stravie).
--
-- Celowo NIE rename'ujemy strava_activities / strava_activities_clean /
-- strain_correlations — cały istniejący kod (widok + konsumenci) czyta
-- przez te nazwy i działa bez zmian. Tabela staje się źródło-agnostyczna:
-- `source` rozróżnia stare wiersze Stravy od nowych z intervals.icu.
-- `strava_id` (bigint) dla nowych wierszy = numeryczna część id z
-- intervals.icu (np. "i162610403" -> 162610403), unikalna per athlete.
-- =============================================================

ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'strava',
  ADD COLUMN IF NOT EXISTS icu_activity_id text,
  ADD COLUMN IF NOT EXISTS icu_hr_zone_times jsonb,
  ADD COLUMN IF NOT EXISTS trimp numeric;

COMMENT ON COLUMN public.strava_activities.source IS
  'Skąd przyszedł wiersz: strava (historyczne, do 2026-06-30) albo garmin_intervals (od 2026-07 przez intervals.icu API)';
COMMENT ON COLUMN public.strava_activities.icu_activity_id IS
  'Oryginalne id aktywności w intervals.icu (np. i162610403), do debugowania/re-fetchu';
COMMENT ON COLUMN public.strava_activities.icu_hr_zone_times IS
  'Sekundy w każdej z 7 stref HR, policzone przez intervals.icu (icu_hr_zone_times)';
COMMENT ON COLUMN public.strava_activities.trimp IS
  'TRIMP (training impulse) z intervals.icu — odpowiednik suffer_score ze Stravy';

-- intervals.icu auth: statyczny klucz API (Basic Auth: API_KEY:<key>),
-- bez refresh_token/expires_at jak przy Stravie — brak rotacji.
CREATE TABLE IF NOT EXISTS public.intervals_tokens (
  user_id     uuid PRIMARY KEY,
  athlete_id  text NOT NULL,
  api_key     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intervals_tokens ENABLE ROW LEVEL SECURITY;

-- Wzorzec jak strava_tokens: tylko service_role, klucz API nigdy nie
-- powinien być czytelny z przeglądarki (XSS blast radius).
CREATE POLICY "Service role only intervals_tokens"
  ON public.intervals_tokens FOR ALL TO service_role
  USING (true);
