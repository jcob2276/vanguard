-- ============================================================
-- VANGUARD OS — METADATA & CONFLICTS
-- Cel: Przygotowanie tabeli wiedzy pod zaawansowaną kategoryzację i detekcję konfliktów.
-- ============================================================

-- 1. DODANIE METADANYCH DO WIEDZY
ALTER TABLE public.vanguard_knowledge 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. DODANIE OSI CZASU DO WIEDZY (Dla detekcji konfliktów temporalnych)
ALTER TABLE public.vanguard_knowledge 
ADD COLUMN IF NOT EXISTS valid_until timestamptz;

-- 3. INDEKS DLA SZYBKIEGO PRZESZUKIWANIA METADANYCH
CREATE INDEX IF NOT EXISTS idx_vanguard_knowledge_metadata ON public.vanguard_knowledge USING gin (metadata);
