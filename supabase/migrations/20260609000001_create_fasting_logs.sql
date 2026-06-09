CREATE TABLE IF NOT EXISTS public.fasting_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       text NOT NULL,  -- 'YYYY-MM-DD' Warsaw tz
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.fasting_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_select" ON public.fasting_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_insert" ON public.fasting_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_update" ON public.fasting_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_delete" ON public.fasting_logs
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fasting_logs_user_date
  ON public.fasting_logs (user_id, date DESC);
