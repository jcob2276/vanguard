-- Sprint close (12-week cycle) — reflection layer; goal text stays in sprint_goals.
CREATE TABLE IF NOT EXISTS public.sprint_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personal_year integer NOT NULL,
  sprint_number integer NOT NULL,
  reflection text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, personal_year, sprint_number)
);

ALTER TABLE public.sprint_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY sprint_reviews_owner ON public.sprint_reviews
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS sprint_reviews_user_year_idx
  ON public.sprint_reviews (user_id, personal_year, sprint_number);
