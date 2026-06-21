-- Caches the AI-generated week recap (sleep/food/PowerList synthesis) so it's
-- generated once per week_start, not on every render of the planning screen.
ALTER TABLE public.weekly_reviews ADD COLUMN IF NOT EXISTS ai_recap jsonb;
