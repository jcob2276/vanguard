-- ============================================================
-- VANGUARD OS — SCHEMA FIX
-- Cel: Dodanie brakującej kolumny 'category' do vanguard_knowledge.
-- Bez tego memory loop wywala błąd przy próbie zapisu.
-- ============================================================

ALTER TABLE public.vanguard_knowledge 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'pattern';

-- Indeks dla wydajności filtrowania po kategorii
CREATE INDEX IF NOT EXISTS idx_vanguard_knowledge_category ON public.vanguard_knowledge(category);
