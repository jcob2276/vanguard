-- ============================================================
-- VANGUARD OS — BITEMPORAL TIMELINE ENGINE
-- Wersja: 1.0 | Data: 2026-05-13
-- ============================================================

-- 1. DODANIE OSI CZASU DO STRUMIENIA
ALTER TABLE public.vanguard_stream 
ADD COLUMN IF NOT EXISTS valid_from timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS valid_until timestamptz;

-- 2. INDEKS DLA WYDAJNOŚCI FILTRACJI
CREATE INDEX IF NOT EXISTS idx_vanguard_stream_validity 
ON public.vanguard_stream (valid_until) 
WHERE valid_until IS NULL;

-- 3. AKTUALIZACJA FUNKCJI MATCH (FILTR BI-TEMPORALNY)
CREATE OR REPLACE FUNCTION public.match_vanguard_content(
    query_embedding  vector(1536),
    match_threshold  float,
    match_count      int,
    user_id_param    uuid
)
RETURNS TABLE (
    id             uuid,
    table_name     text,
    content        text,
    source_date    date,
    similarity     float,
    importance_score int,
    hybrid_score   float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH all_content AS (
        -- Filtrujemy vanguard_stream pod kątem ważności czasu
        SELECT vs.id, 'vanguard_stream'::text,
               vs.content, vs.created_at::date as source_date, 
               COALESCE(vs.importance_score, 6) as importance_score, 
               (COALESCE(vs.situation_fingerprint, vs.embedding) <=> query_embedding) as distance
        FROM vanguard_stream vs
        WHERE vs.user_id = user_id_param 
          AND (vs.situation_fingerprint IS NOT NULL OR vs.embedding IS NOT NULL)
          -- KLUCZOWY FILTR BI-TEMPORALNY:
          AND (vs.valid_until IS NULL OR vs.valid_until > now())

        UNION ALL

        -- Pozostałe tabele (Wiedza, Fundamenty itd.)
        SELECT vk.id, 'vanguard_knowledge'::text,
               vk.content, vk.created_at::date, vk.importance_score,
               (vk.embedding <=> query_embedding)
        FROM vanguard_knowledge vk
        WHERE vk.user_id = user_id_param AND vk.embedding IS NOT NULL

        UNION ALL

        SELECT dw.id, 'daily_wins'::text,
               COALESCE(dw.journal_entry,'') || ' ' || COALESCE(dw.gratitude_entry,''),
               dw.date, 5, (dw.embedding <=> query_embedding)
        FROM daily_wins dw WHERE dw.user_id = user_id_param AND dw.embedding IS NOT NULL

        UNION ALL

        SELECT uf.user_id, 'user_fundament'::text,
               COALESCE(uf.identity,'') || ' ' || COALESCE(uf.philosophy,''),
               uf.updated_at::date, 10, (uf.embedding <=> query_embedding)
        FROM user_fundament uf WHERE uf.user_id = user_id_param AND uf.embedding IS NOT NULL
    ),
    scored AS (
        SELECT *, 
               (1 - distance) as similarity,
               EXP(- (EXTRACT(EPOCH FROM (now() - (source_date::timestamp))) / (86400.0 * 30.0))) as recency_weight
        FROM all_content
        WHERE (1 - distance) > match_threshold
    )
    SELECT a.id, a.table_name, a.content, a.source_date, a.similarity, a.importance_score,
           ((a.similarity * 0.5) + ((a.importance_score / 10.0) * 0.3) + (a.recency_weight * 0.2))::float as hybrid_score
    FROM scored a
    ORDER BY hybrid_score DESC
    LIMIT match_count;
END;
$$;
