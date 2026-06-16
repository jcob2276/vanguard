-- Dreams v2: opis wizji + flaga Top 5
ALTER TABLE public.dreams ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.dreams ADD COLUMN IF NOT EXISTS is_top5 boolean NOT NULL DEFAULT false;
