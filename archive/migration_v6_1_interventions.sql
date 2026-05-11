-- MIGRATION: V6.1 - INTERVENTION TRACKING
-- Dodaje flagę interwencji do dziennika

ALTER TABLE public.daily_wins ADD COLUMN IF NOT EXISTS is_intervention BOOLEAN DEFAULT false;
