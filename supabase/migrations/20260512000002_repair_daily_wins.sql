-- MIGRACJA NAPRAWCZA: DAILY_WINS SCHEMA SYNC
-- Upewnienie się, że wszystkie kolumny wymagane przez VanguardCore istnieją.

ALTER TABLE public.daily_wins 
ADD COLUMN IF NOT EXISTS journal_entry TEXT,
ADD COLUMN IF NOT EXISTS gratitude_entry TEXT,
ADD COLUMN IF NOT EXISTS mood_score INTEGER;

-- Komentarz dla AI/Deva
COMMENT ON COLUMN public.daily_wins.gratitude_entry IS 'Wpisy wdzięczności użytkownika.';
COMMENT ON COLUMN public.daily_wins.mood_score IS 'Subiektywna ocena nastroju (1-5).';
