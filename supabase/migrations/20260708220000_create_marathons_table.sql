-- ============================================================
-- CREATE MARATHONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marathons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  date date NOT NULL,
  target_time interval,
  status text CHECK (status IN ('upcoming', 'completed', 'cancelled')) DEFAULT 'upcoming',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.marathons ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can select their own marathons"
  ON public.marathons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own marathons"
  ON public.marathons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own marathons"
  ON public.marathons FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own marathons"
  ON public.marathons FOR DELETE
  USING (auth.uid() = user_id);

-- Seed initial marathon for Jakub to preserve the existing "Maraton Gdańsk" target
INSERT INTO public.marathons (user_id, name, date, target_time, status)
VALUES (
  '165ae341-670c-46ce-82dc-434c4dbfcdfd',
  'Maraton Gdańsk',
  '2026-10-04',
  '03:45:00'::interval,
  'upcoming'
) ON CONFLICT DO NOTHING;
