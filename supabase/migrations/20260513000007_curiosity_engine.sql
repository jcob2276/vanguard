-- ============================================================
-- VANGUARD OS — CURIOSITY ENGINE (MINDSET IQ 1000)
-- Tabela dla hipotez, prowokacji i analizy przemilczeń
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vanguard_curiosity_queue (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    hypothesis text NOT NULL, -- Opis hipotezy (np. "Jakub ucieka w kodowanie przed relacjami")
    provocation text NOT NULL, -- Zdanie, które bot wypowie na Telegramie
    confidence_score float CHECK (confidence_score >= 0 AND confidence_score <= 1.0),
    category text DEFAULT 'psychology', -- psychology, business, biology, shadow
    evidence_count integer DEFAULT 1, -- Ile razy ten wzorzec został zauważony
    status text DEFAULT 'pending', -- pending, active, archived
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indeks dla szybkich odczytów najpewniejszych hipotez
CREATE INDEX IF NOT EXISTS idx_vanguard_curiosity_confidence 
ON public.vanguard_curiosity_queue (confidence_score DESC) 
WHERE status = 'pending';
