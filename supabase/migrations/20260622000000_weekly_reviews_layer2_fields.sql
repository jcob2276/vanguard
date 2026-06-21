-- Layer 2 of the holistic weekly review: 3 separate 1-10 pillar self-ratings
-- (replaces the old 4-button mood picker) plus a free-text "what's hanging
-- over your head" field with no existing column to repurpose.
ALTER TABLE public.weekly_reviews
  ADD COLUMN IF NOT EXISTS pillar_scores jsonb,
  ADD COLUMN IF NOT EXISTS obligation text;
