-- MIGRATION: V6 - SEMANTIC LAYER
-- Wdraża warstwę semantyczną: pgvector, embeddingi, hybrydowe wyszukiwanie i linki temporalne.

-- 1. Aktywacja rozszerzenia pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Dodanie kolumn embedding i importance_score do kluczowych tabel

-- Tabela wiedzy (uzupełnienie V5)
ALTER TABLE public.vanguard_knowledge ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Tabela dziennika (daily_wins)
ALTER TABLE public.daily_wins ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE public.daily_wins ADD COLUMN IF NOT EXISTS importance_score INTEGER DEFAULT 5;

-- Tabela przeglądów tygodniowych (weekly_reviews)
ALTER TABLE public.weekly_reviews ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE public.weekly_reviews ADD COLUMN IF NOT EXISTS importance_score INTEGER DEFAULT 5;

-- Tabela fundamentu (user_fundament)
ALTER TABLE public.user_fundament ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE public.user_fundament ADD COLUMN IF NOT EXISTS importance_score INTEGER DEFAULT 10; -- Fundament jest zawsze ważny

-- Tabela sesji treningowych (workout_sessions)
ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS importance_score INTEGER DEFAULT 5;

-- 3. Tabela linków temporalnych (przyczynowość w czasie)
CREATE TABLE IF NOT EXISTS public.vanguard_temporal_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    source_date DATE NOT NULL,
    target_date DATE NOT NULL,
    link_type TEXT CHECK (link_type IN ('CAUSAL', 'RECOVERY', 'DEGRADATION', 'INTERVENTION')),
    description TEXT,
    strength FLOAT DEFAULT 1.0, -- Siła korelacji 0.0 - 1.0
    metadata JSONB DEFAULT '{}', -- Np. { "hrv_delta": +8, "sleep_delta": +0.5 }
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temporal_links_user_date ON public.vanguard_temporal_links(user_id, source_date);

-- 4. Funkcja do wyszukiwania hybrydowego
-- Łączy podobieństwo semantyczne, ważność i świeżość
CREATE OR REPLACE FUNCTION match_vanguard_content(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    user_id_param uuid
)
RETURNS TABLE (
    id uuid,
    content_type text,
    content text,
    source_date date,
    importance_score int,
    similarity float,
    combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH all_content AS (
        -- Knowledge
        SELECT 
            k.id, 
            'knowledge'::text as content_type, 
            k.title || ': ' || k.content as content, 
            k.created_at::date as source_date, 
            k.importance_score, 
            1 - (k.embedding <=> query_embedding) as similarity
        FROM vanguard_knowledge k
        WHERE k.user_id = user_id_param AND k.embedding IS NOT NULL
        
        UNION ALL
        
        -- Journal
        SELECT 
            dw.id, 
            'journal'::text as content_type, 
            'Mood: ' || dw.mood_score || ' | ' || COALESCE(dw.journal_entry, '') || ' | ' || COALESCE(dw.gratitude_entry, '') as content, 
            dw.date as source_date, 
            dw.importance_score, 
            1 - (dw.embedding <=> query_embedding) as similarity
        FROM daily_wins dw
        WHERE dw.user_id = user_id_param AND dw.embedding IS NOT NULL
        
        UNION ALL
        
        -- Weekly Review
        SELECT 
            wr.id, 
            'weekly_review'::text as content_type, 
            'Proud: ' || wr.proud_of || ' | Sabotage: ' || wr.sabotage || ' | Differently: ' || wr.do_differently as content, 
            wr.week_start as source_date, 
            wr.importance_score, 
            1 - (wr.embedding <=> query_embedding) as similarity
        FROM weekly_reviews wr
        WHERE wr.user_id = user_id_param AND wr.embedding IS NOT NULL
    )
    SELECT 
        ac.id,
        ac.content_type,
        ac.content,
        ac.source_date,
        ac.importance_score,
        ac.similarity,
        (
            (ac.similarity * 0.5) +                                   -- 50% Semantic
            ((ac.importance_score::float / 10.0) * 0.3) +             -- 30% Importance
            (exp(-0.005 * (CURRENT_DATE - ac.source_date)) * 0.2)     -- 20% Recency (decay)
        ) as combined_score
    FROM all_content ac
    WHERE ac.similarity > match_threshold
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;
