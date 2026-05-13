-- ============================================================
-- VANGUARD OS — RETRIEVAL CALIBRATION & SOURCE PRIORITY
-- Cel: Wprowadzenie hierarchii źródeł i obniżenie szumów.
-- ============================================================

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
        -- 1. FUNDAMENT (Priorytet najwyższy: 1.0)
        SELECT 
            uf.user_id as r_id, 
            'user_fundament'::text as r_table,
            COALESCE(uf.identity,'') || ' ' || COALESCE(uf.philosophy,'') || ' ' || COALESCE(uf.vision,'') as r_content,
            uf.updated_at::date as r_date, 
            10 as r_importance,
            (uf.embedding <=> query_embedding) as r_dist,
            1.0 as r_priority_boost
        FROM user_fundament uf 
        WHERE uf.user_id = user_id_param 
          AND uf.embedding IS NOT NULL
          AND btrim(COALESCE(uf.identity,'') || COALESCE(uf.philosophy,'')) != ''

        UNION ALL

        -- 2. WIEDZA (Weryfikowana: 0.8, Inna: 0.4)
        SELECT 
            vk.id, 
            'vanguard_knowledge'::text,
            vk.content, 
            vk.created_at::date, 
            vk.importance_score,
            (vk.embedding <=> query_embedding),
            CASE WHEN vk.is_verified THEN 0.8 ELSE 0.4 END
        FROM vanguard_knowledge vk
        WHERE vk.user_id = user_id_param 
          AND vk.embedding IS NOT NULL
          AND btrim(vk.content) != ''

        UNION ALL

        -- 3. STRUMIEŃ (Bieżący: 0.6)
        SELECT 
            vs.id, 
            'vanguard_stream'::text,
            vs.content, 
            vs.created_at::date, 
            COALESCE(vs.importance_score, 6), 
            (vs.embedding <=> query_embedding),
            0.6
        FROM vanguard_stream vs
        WHERE vs.user_id = user_id_param 
          AND vs.embedding IS NOT NULL
          AND btrim(vs.content) != ''
          AND (vs.valid_until IS NULL OR vs.valid_until > now())

        UNION ALL

        -- 4. DZIENNIK (0.5)
        SELECT 
            dw.id, 
            'daily_wins'::text,
            COALESCE(dw.journal_entry,'') || ' ' || COALESCE(dw.gratitude_entry,''),
            dw.date, 
            5, 
            (dw.embedding <=> query_embedding),
            0.5
        FROM daily_wins dw 
        WHERE dw.user_id = user_id_param 
          AND dw.embedding IS NOT NULL
          AND btrim(COALESCE(dw.journal_entry,'') || COALESCE(dw.gratitude_entry,'')) != ''
    ),
    scored AS (
        SELECT 
            ac.*,
            (1 - ac.r_dist) as r_similarity,
            EXP(- (EXTRACT(EPOCH FROM (now() - (ac.r_date::timestamp))) / (86400.0 * 30.0))) as r_recency
        FROM all_content ac
        WHERE (1 - ac.r_dist) > match_threshold
    )
    SELECT 
        s.r_id, 
        s.r_table, 
        s.r_content, 
        s.r_date, 
        s.r_similarity, 
        s.r_importance,
        (
            (s.r_similarity * 0.4) +           -- Podobieństwo (40%)
            (s.r_priority_boost * 0.4) +       -- Priorytet źródła (40%)
            (s.r_recency * 0.1) +              -- Aktualność (10%)
            ((s.r_importance / 10.0) * 0.1)    -- Ważność (10%)
        )::float as r_hybrid_score
    FROM scored s
    ORDER BY r_hybrid_score DESC
    LIMIT match_count;
END;
$$;
