-- MIGRACJA: POWER LIST UPGRADE (v7.0)
-- Dodanie timestampów, RPE i tagów dla wyższej rozdzielczości danych.

ALTER TABLE public.daily_wins 
ADD COLUMN IF NOT EXISTS completed_at_1 TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at_2 TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at_3 TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at_4 TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at_5 TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS daily_rpe INTEGER CHECK (daily_rpe BETWEEN 1 AND 10),
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Komentarz dla AI/Deva
COMMENT ON COLUMN public.daily_wins.daily_rpe IS 'Rate of Perceived Exertion (1-10) dla całego dnia.';
