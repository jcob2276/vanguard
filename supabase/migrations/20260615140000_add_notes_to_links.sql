ALTER TABLE public.vanguard_links
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
