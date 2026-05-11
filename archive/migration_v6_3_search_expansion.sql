-- Rozszerza funkcję match_vanguard_content o treningi i fundament

DROP FUNCTION IF EXISTS public.match_vanguard_content(vector,float,int,uuid);

CREATE OR REPLACE FUNCTION public.match_vanguard_content(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    user_id_param uuid
)
RETURNS TABLE (
    id uuid,
    table_name text,
    content text,
    source_date date,
    similarity float,
    importance_score int,
    hybrid_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH all_content AS (
        -- Knowledge
        SELECT 
            vk.id, 
            'vanguard_knowledge'::text as table_name, 
            vk.content, 
            vk.created_at::date as source_date,
            vk.importance_score,
            (vk.embedding <=> query_embedding) as distance
        FROM vanguard_knowledge vk
        WHERE vk.user_id = user_id_param
        
        UNION ALL
        
        -- Journal (Daily Wins)
        SELECT 
            dw.id, 
            'daily_wins'::text as table_name, 
            COALESCE(dw.journal_entry, '') || ' ' || COALESCE(dw.gratitude_entry, '') as content, 
            dw.date as source_date,
            5 as importance_score,
            (dw.embedding <=> query_embedding) as distance
        FROM daily_wins dw
        WHERE dw.user_id = user_id_param AND dw.embedding IS NOT NULL
        
        UNION ALL
        
        -- Weekly Reviews
        SELECT 
            wr.id, 
            'weekly_reviews'::text as table_name, 
            COALESCE(wr.proud_of, '') || ' ' || COALESCE(wr.sabotage, '') as content, 
            wr.week_start as source_date,
            7 as importance_score,
            (wr.embedding <=> query_embedding) as distance
        FROM weekly_reviews wr
        WHERE wr.user_id = user_id_param AND wr.embedding IS NOT NULL

        UNION ALL

        -- Workout Sessions
        SELECT 
            ws.id, 
            'workout_sessions'::text as table_name, 
            ws.session_notes as content, 
            ws.date as source_date,
            4 as importance_score,
            (ws.embedding <=> query_embedding) as distance
        FROM workout_sessions ws
        WHERE ws.user_id = user_id_param AND ws.embedding IS NOT NULL

        UNION ALL

        -- User Fundament
        SELECT 
            uf.user_id as id, 
            'user_fundament'::text as table_name, 
            COALESCE(uf.identity, '') || ' ' || COALESCE(uf.philosophy, '') as content, 
            uf.updated_at::date as source_date,
            10 as importance_score,
            (uf.embedding <=> query_embedding) as distance
        FROM user_fundament uf
        WHERE uf.user_id = user_id_param AND uf.embedding IS NOT NULL
    ),
    scored_content AS (
        SELECT 
            ac.*,
            (1 - ac.distance) as similarity,
            -- Recency decay: exp(-0.005 * days_old)
            exp(-0.005 * (current_date - ac.source_date)) as recency_weight
        FROM all_content ac
        WHERE (1 - ac.distance) > match_threshold
    )
    SELECT 
        sc.id,
        sc.table_name,
        sc.content,
        sc.source_date,
        sc.similarity,
        sc.importance_score,
        -- HYBRID SCORE: 50% Similarity + 30% Importance + 20% Recency
        (
            (sc.similarity * 0.5) + 
            ((sc.importance_score / 10.0) * 0.3) + 
            (sc.recency_weight * 0.2)
        )::float as hybrid_score
    FROM scored_content sc
    ORDER BY hybrid_score DESC
    LIMIT match_count;
END;
$$;
