-- ============================================================
-- VANGUARD OS — AUTO-CLASSIFY & SITUATION FINGERPRINT
-- Wersja: 1.0 | Data: 2026-05-13
-- ============================================================

-- 1. DODANIE KOLUMN ANALITYCZNYCH DO STRUMIENIA
ALTER TABLE public.vanguard_stream 
ADD COLUMN IF NOT EXISTS importance_score smallint CHECK (importance_score >= 1 AND importance_score <= 10),
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS tags text[],
ADD COLUMN IF NOT EXISTS situation_fingerprint vector(1536);

-- 2. INDEKS HNSW DLA NOWEGO FINGERPRINTU
-- Pozwala na błyskawiczne wyszukiwanie podobnych stanów psychofizycznych.
CREATE INDEX IF NOT EXISTS idx_vanguard_stream_fingerprint 
ON public.vanguard_stream 
USING hnsw (situation_fingerprint vector_cosine_ops);

-- KOMENTARZ: 
-- Po uruchomieniu tej migracji, należy skonfigurować Database Webhook w Supabase,
-- który będzie uderzał w funkcję 'vanguard-auto-classify' przy każdym INSERT.
