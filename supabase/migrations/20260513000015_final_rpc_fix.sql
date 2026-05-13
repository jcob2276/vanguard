-- ============================================================
-- VANGUARD OS — FINAL RPC FIX
-- Cel: Rozwiązanie problemu niejednoznaczności kolumn w match_vanguard_content.
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
        -- Strumień (Vanguard Stream)
        SELECT 
            vs.id, 
            'vanguard_stream'::text as t_name,
            vs.content as c_text, 
            vs.created_at::date as s_date, 
            COALESCE(vs.importance_score, 6) as i_score, 
            (vs.embedding <=> query_embedding) as dist
        FROM vanguard_stream vs
        WHERE vs.user_id = user_id_param 
          AND vs.embedding IS NOT NULL
          AND (vs.valid_until IS NULL OR vs.valid_until > now())

        UNION ALL

        -- Wiedza (Vanguard Knowledge)
        SELECT 
            vk.id, 
            'vanguard_knowledge'::text,
            vk.content, 
            vk.created_at::date, 
            vk.importance_score,
            (vk.embedding <=> query_embedding)
        FROM vanguard_knowledge vk
        WHERE vk.user_id = user_id_param AND vk.embedding IS NOT NULL

        UNION ALL

        -- Dziennik (Daily Wins / Journal)
        SELECT 
            dw.id, 
            'daily_wins'::text,
            COALESCE(dw.journal_entry,'') || ' ' || COALESCE(dw.gratitude_entry,''),
            dw.date, 
            5, 
            (dw.embedding <=> query_embedding)
        FROM daily_wins dw 
        WHERE dw.user_id = user_id_param AND dw.embedding IS NOT NULL

        UNION ALL

        -- Fundament (User Fundament)
        SELECT 
            uf.user_id as id, 
            'user_fundament'::text,
            COALESCE(uf.identity,'') || ' ' || COALESCE(uf.philosophy,'') || ' ' || COALESCE(uf.vision,''),
            uf.updated_at::date, 
            10, 
            (uf.embedding <=> query_embedding)
        FROM user_fundament uf 
        WHERE uf.user_id = user_id_param AND uf.embedding IS NOT NULL
    ),
    scored AS (
        SELECT 
            ac.id as r_id, 
            ac.t_name as r_table, 
            ac.c_text as r_content, 
            ac.s_date as r_date, 
            ac.i_score as r_importance,
            (1 - ac.dist) as r_similarity,
            EXP(- (EXTRACT(EPOCH FROM (now() - (ac.s_date::timestamp))) / (86400.0 * 30.0))) as r_recency
        FROM all_content ac
        WHERE (1 - ac.dist) > match_threshold
    )
    SELECT 
        s.r_id, 
        s.r_table, 
        s.r_content, 
        s.r_date, 
        s.r_similarity, 
        s.r_importance,
        ((s.r_similarity * 0.5) + ((s.r_importance / 10.0) * 0.3) + (s.r_recency * 0.2))::float as r_hybrid_score
    FROM scored s
    ORDER BY r_hybrid_score DESC
    LIMIT match_count;
END;
$$;
