-- Monthly review layer — between sprint (12w) and weekly in the goal spine.
CREATE TABLE IF NOT EXISTS public.monthly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  pattern_note text,
  leverage_note text,
  correction_note text,
  month_theme text,
  carry_over text,
  ai_recap jsonb,
  ritual_stats jsonb,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, month_start)
);

ALTER TABLE public.monthly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY monthly_reviews_owner ON public.monthly_reviews
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS monthly_reviews_user_month_idx
  ON public.monthly_reviews (user_id, month_start DESC);
