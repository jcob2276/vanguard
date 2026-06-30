-- daily_plan: zero write paths anywhere in app (only read by compute-correlations,
-- which is updated in the same change to stop selecting from it). daily_wins already
-- covers daily task planning.
-- weekly_kpi_reviews: zero write paths anywhere in app or DB functions. Confirmed by
-- direct query against information_schema/routines; only 1 stray test row existed.
DROP TABLE IF EXISTS public.daily_plan;
DROP TABLE IF EXISTS public.weekly_kpi_reviews;
