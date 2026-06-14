-- Add focus_task_ids uuid[] to weekly_reviews, and define weekly_reviews if not exists.
CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_sentiment text,
  week_focus text,
  proud_of text,
  bottleneck text,
  focus_task_ids uuid[] DEFAULT '{}'::uuid[],
  focus_goal_mappings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

-- Ensure RLS is enabled and policies are created
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_reviews_select" ON public.weekly_reviews;
DROP POLICY IF EXISTS "weekly_reviews_insert" ON public.weekly_reviews;
DROP POLICY IF EXISTS "weekly_reviews_update" ON public.weekly_reviews;

CREATE POLICY "weekly_reviews_select" ON public.weekly_reviews FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "weekly_reviews_insert" ON public.weekly_reviews FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "weekly_reviews_update" ON public.weekly_reviews FOR UPDATE USING ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON public.weekly_reviews TO authenticated;

-- Add columns if the table existed but columns were missing
ALTER TABLE public.weekly_reviews ADD COLUMN IF NOT EXISTS focus_task_ids uuid[] DEFAULT '{}'::uuid[];
ALTER TABLE public.weekly_reviews ADD COLUMN IF NOT EXISTS proud_of text;
ALTER TABLE public.weekly_reviews ADD COLUMN IF NOT EXISTS bottleneck text;
ALTER TABLE public.weekly_reviews ADD COLUMN IF NOT EXISTS focus_goal_mappings jsonb DEFAULT '{}'::jsonb;
