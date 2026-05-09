-- MIGRACJA: PRYWATNOŚĆ LOKALIZACJI
-- Przeniesienie współrzędnych POI z kodu do bazy danych

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS home_lat DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS home_lng DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS work_lat DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS work_lng DECIMAL(9,6);

-- Opcjonalnie: Przykładowe ustawienie dla obecnego użytkownika
-- UPDATE public.user_settings SET home_lat = 49.6766, home_lng = 21.7147 WHERE user_id = 'YOUR_USER_ID';
