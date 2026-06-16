-- Projekty: link do marzenia źródłowego
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS dream_id uuid REFERENCES public.dreams(id) ON DELETE SET NULL;
