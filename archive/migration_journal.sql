-- MIGRACJA DLA SEKCJI JOURNALING (DZIENNIK)

ALTER TABLE public.daily_wins ADD COLUMN IF NOT EXISTS journal_entry TEXT;
ALTER TABLE public.daily_wins ADD COLUMN IF NOT EXISTS gratitude_entry TEXT;
ALTER TABLE public.daily_wins ADD COLUMN IF NOT EXISTS mood_score INTEGER; -- 1-5
ALTER TABLE public.daily_wins ADD COLUMN IF NOT EXISTS discipline_score INTEGER; -- 1-5
