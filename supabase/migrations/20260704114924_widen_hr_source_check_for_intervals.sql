-- intervals.icu rows use hr_source='garmin_intervals' — widen the check
-- constraint that previously only allowed 'strava'/'oura'.
ALTER TABLE public.strava_activities DROP CONSTRAINT strava_activities_hr_source_check;
ALTER TABLE public.strava_activities ADD CONSTRAINT strava_activities_hr_source_check
  CHECK (hr_source = ANY (ARRAY['strava'::text, 'oura'::text, 'garmin_intervals'::text]));
