-- MIGRATION: V5 - KNOWLEDGE VAULT
-- Skarbiec wiedzy ze szkoleń, książek i PDFów

CREATE TABLE IF NOT EXISTS public.vanguard_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    title TEXT, -- np. "Zasady pracy głębokiej - Cal Newport"
    content TEXT, -- Treść notatki / fragmentu
    source_type TEXT, -- "BOOK", "COURSE", "PDF", "THOUGHT"
    tags TEXT[], -- np. ["produktywność", "skupienie"]
    created_at TIMESTAMPTZ DEFAULT now(),
    importance_score INTEGER DEFAULT 5 -- 1-10
);

CREATE INDEX IF NOT EXISTS idx_vanguard_knowledge_user ON public.vanguard_knowledge(user_id);
