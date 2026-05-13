-- ============================================================
-- VANGUARD OS — BRAIN RECOVERY MIGRATION
-- Cel: Naprawa mechanizmu retrievalu i dodanie audytu zdrowia mózgu.
-- ============================================================

-- 1. NAPRAWA match_vanguard_content
-- Usuwamy błędne referencje i standaryzujemy wyszukiwanie hybrydowe.
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

-- 2. DODANIE RAPORTU ZDROWIA MÓZGU (Brain Health Report)
CREATE OR REPLACE FUNCTION public.get_brain_health_report(user_id_param uuid)
RETURNS TABLE (
    table_name text,
    total_records bigint,
    embedded_records bigint,
    coverage_percent numeric
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.name as table_name,
        t.total as total_records,
        t.embedded as embedded_records,
        CASE WHEN t.total > 0 THEN ROUND((t.embedded::numeric / t.total::numeric) * 100, 2) ELSE 0 END as coverage_percent
    FROM (
        SELECT 'vanguard_stream' as name, COUNT(*)::bigint as total, COUNT(embedding)::bigint as embedded FROM vanguard_stream WHERE user_id = user_id_param
        UNION ALL
        SELECT 'vanguard_knowledge' as name, COUNT(*)::bigint as total, COUNT(embedding)::bigint as embedded FROM vanguard_knowledge WHERE user_id = user_id_param
        UNION ALL
        SELECT 'vanguard_entity_links' as name, COUNT(*)::bigint as total, 0::bigint as embedded FROM vanguard_entity_links WHERE user_id = user_id_param
        UNION ALL
        SELECT 'daily_wins' as name, COUNT(*)::bigint as total, COUNT(embedding)::bigint as embedded FROM daily_wins WHERE user_id = user_id_param
        UNION ALL
        SELECT 'user_fundament' as name, COUNT(*)::bigint as total, COUNT(embedding)::bigint as embedded FROM user_fundament WHERE user_id = user_id_param
    ) t;
END;
$$;

-- 3. DODANIE KOLUMNY WARSTWY DO GRAFU (Layering)
ALTER TABLE public.vanguard_entity_links 
ADD COLUMN IF NOT EXISTS layer text DEFAULT 'intelligence'; -- 'intelligence' | 'telemetry'

-- Indeks dla wydajności filtrowania po warstwie
CREATE INDEX IF NOT EXISTS idx_entity_links_layer ON public.vanguard_entity_links(layer);

-- Aktualizacja istniejących relacji biometrycznych do warstwy telemetrycznej
UPDATE public.vanguard_entity_links
SET layer = 'telemetry'
WHERE source_entity IN ('gotowość', 'sleep_z', 'execution_score', 'hrv_avg', 'rhr_avg', 'readiness_score')
   OR target_entity IN ('gotowość', 'sleep_z', 'execution_score', 'hrv_avg', 'rhr_avg', 'readiness_score');

-- 4. AKTUALIZACJA get_vanguard_graph_context O WARSTWY
CREATE OR REPLACE FUNCTION public.get_vanguard_graph_context(
  start_entities text[],
  max_depth integer DEFAULT 2,
  user_id_param uuid DEFAULT NULL,
  p_layer text DEFAULT 'intelligence'
)
RETURNS TABLE (
  source_entity text,
  relation text,
  target_entity text,
  depth integer,
  path text[]
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE graph_path AS (
    -- Anchor
    SELECT 
      l.source_entity, 
      l.relation, 
      l.target_entity, 
      1 as depth,
      ARRAY[l.source_entity, l.target_entity] as path
    FROM public.vanguard_entity_links l
    WHERE l.user_id = user_id_param 
      AND (l.source_entity = ANY(start_entities) OR l.target_entity = ANY(start_entities))
      AND l.evidence_count >= 1
      AND (p_layer IS NULL OR l.layer = p_layer)

    UNION ALL

    -- Recursive step
    SELECT 
      l.source_entity, 
      l.relation, 
      l.target_entity, 
      gp.depth + 1,
      gp.path || l.target_entity
    FROM public.vanguard_entity_links l
    JOIN graph_path gp ON (l.source_entity = gp.target_entity OR l.target_entity = gp.source_entity)
    WHERE l.user_id = user_id_param 
      AND gp.depth < max_depth
      AND l.evidence_count >= 1
      AND (p_layer IS NULL OR l.layer = p_layer)
      AND NOT (l.target_entity = ANY(gp.path))
  )
  SELECT DISTINCT ON (gp.source_entity, gp.relation, gp.target_entity)
    gp.source_entity, gp.relation, gp.target_entity, gp.depth, gp.path
  FROM graph_path gp
  ORDER BY gp.source_entity, gp.relation, gp.target_entity, gp.depth ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
