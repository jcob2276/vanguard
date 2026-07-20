-- Life admin: recurring obligations (birthdays, vehicle, documents) with lead reminders.

CREATE TABLE IF NOT EXISTS public.life_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('people', 'vehicle', 'document', 'home', 'finance', 'health_admin')),
  related_name text,
  anchor_date date NOT NULL,
  recurrence text NOT NULL DEFAULT 'yearly'
    CHECK (recurrence IN ('yearly', 'once', 'monthly')),
  lead_offsets integer[] NOT NULL DEFAULT ARRAY[-14, -7, 0],
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sent_reminders jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS life_obligations_user_active_idx
  ON public.life_obligations (user_id)
  WHERE is_active = true;

ALTER TABLE public.life_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own life_obligations"
  ON public.life_obligations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own life_obligations"
  ON public.life_obligations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own life_obligations"
  ON public.life_obligations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own life_obligations"
  ON public.life_obligations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access life_obligations"
  ON public.life_obligations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.life_obligations IS
  'Life admin obligations (birthdays, vehicle inspection, insurance) with lead-offset reminders.';
