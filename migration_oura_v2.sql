-- MIGRACJA: OURA DATA ENHANCEMENT (V2)
-- Rozszerzenie tabeli o brakujące metryki i indeksy.

ALTER TABLE public.oura_daily_summary 
ADD COLUMN IF NOT EXISTS deep_sleep_hours DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS rem_sleep_hours DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS hrv_avg INTEGER,
ADD COLUMN IF NOT EXISTS rhr_avg INTEGER,
ADD COLUMN IF NOT EXISTS temp_deviation DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS sleep_efficiency INTEGER,
ADD COLUMN IF NOT EXISTS latency_minutes INTEGER;

-- Dodanie indeksu dla szybkiego pobierania historii biometrycznej
CREATE INDEX IF NOT EXISTS idx_oura_user_date_desc ON public.oura_daily_summary(user_id, date DESC);

-- Komentarz dla AI Mentor
COMMENT ON TABLE public.oura_daily_summary IS 'Przechowuje kompleksowe dane biometryczne z Oura Ring do analizy readiness i stanu układu nerwowego.';
