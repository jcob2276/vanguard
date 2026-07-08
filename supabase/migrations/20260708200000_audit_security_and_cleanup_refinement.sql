-- ============================================================
-- AUDIT REFINEMENT — SECURITY DEFINER, SSOT & GRAPH CLEANUP
-- ============================================================

-- Drop functions before recreating to avoid return type mismatch errors
DROP FUNCTION IF EXISTS public.get_vanguard_graph_context(text[], integer, uuid, text, boolean, timestamp with time zone, double precision) CASCADE;
DROP FUNCTION IF EXISTS public.search_entity_links(public.vector, uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.search_entity_links_fulltext(text, uuid, integer) CASCADE;

-- 1. Redefine vanguard_graph_cleanup() to use soft-deprecation and entity merges
CREATE OR REPLACE FUNCTION public.vanguard_graph_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r RECORD;
    r_source RECORD;
    r_target RECORD;
    v_loser_uuid uuid;
    v_winner_uuid uuid;
BEGIN
    -- 1. Entity Resolution loop
    FOR r IN (
        SELECT DISTINCT ON (least(e1.name, e2.name), greatest(e1.name, e2.name))
            e1.name as loser,
            e2.name as winner,
            e1.user_id
        FROM (
            SELECT DISTINCT source_entity as name, user_id FROM public.vanguard_entity_links
            UNION
            SELECT DISTINCT target_entity as name, user_id FROM public.vanguard_entity_links
        ) e1
        JOIN (
            SELECT DISTINCT source_entity as name, user_id FROM public.vanguard_entity_links
            UNION
            SELECT DISTINCT target_entity as name, user_id FROM public.vanguard_entity_links
        ) e2 ON e1.user_id = e2.user_id AND e1.name < e2.name
        WHERE similarity(e1.name, e2.name) > 0.85
        ORDER BY least(e1.name, e2.name), greatest(e1.name, e2.name), 
                 (CASE WHEN length(e2.name) >= length(e1.name) THEN 1 ELSE 0 END) DESC
    ) LOOP
        -- Get or create entity IDs to map the merge
        v_loser_uuid := public.resolve_entity(r.user_id, r.loser, 'concept');
        v_winner_uuid := public.resolve_entity(r.user_id, r.winner, 'concept');

        IF v_loser_uuid IS NOT NULL AND v_winner_uuid IS NOT NULL AND v_loser_uuid <> v_winner_uuid THEN
            -- Map the soft-merge in public.entities
            UPDATE public.entities
            SET merged_into = v_winner_uuid
            WHERE id = v_loser_uuid;

            -- Add the loser's name as an alias for the winner
            INSERT INTO public.entity_aliases (entity_id, alias)
            VALUES (v_winner_uuid, r.loser)
            ON CONFLICT DO NOTHING;
        END IF;

        -- FOR EACH ROW OF LOSER AS SOURCE -> upsert as winner
        FOR r_source IN (SELECT * FROM public.vanguard_entity_links WHERE user_id = r.user_id AND source_entity = r.loser AND status = 'active') LOOP
            INSERT INTO public.vanguard_entity_links (
                user_id, source_entity, source_type, relation, target_entity, target_type, weight, evidence_count, first_seen, last_seen, temporal_status, status, observed_at, valid_from, valid_until
            )
            VALUES (
                r.user_id, r.winner, r_source.source_type, r_source.relation, r_source.target_entity, r_source.target_type, r_source.weight, r_source.evidence_count, r_source.first_seen, r_source.last_seen, r_source.temporal_status, r_source.status, r_source.observed_at, r_source.valid_from, r_source.valid_until
            )
            ON CONFLICT (user_id, source_entity, relation, target_entity)
            DO UPDATE SET
                evidence_count = vanguard_entity_links.evidence_count + EXCLUDED.evidence_count,
                weight = GREATEST(vanguard_entity_links.weight, EXCLUDED.weight),
                last_seen = GREATEST(vanguard_entity_links.last_seen, EXCLUDED.last_seen);
        END LOOP;

        -- FOR EACH ROW OF LOSER AS TARGET -> upsert as winner
        FOR r_target IN (SELECT * FROM public.vanguard_entity_links WHERE user_id = r.user_id AND target_entity = r.loser AND status = 'active') LOOP
            INSERT INTO public.vanguard_entity_links (
                user_id, source_entity, source_type, relation, target_entity, target_type, weight, evidence_count, first_seen, last_seen, temporal_status, status, observed_at, valid_from, valid_until
            )
            VALUES (
                r.user_id, r_target.source_entity, r_target.source_type, r_target.relation, r.winner, r_target.target_type, r_target.weight, r_target.evidence_count, r_target.first_seen, r_target.last_seen, r_target.temporal_status, r_target.status, r_target.observed_at, r_target.valid_from, r_target.valid_until
            )
            ON CONFLICT (user_id, source_entity, relation, target_entity)
            DO UPDATE SET
                evidence_count = vanguard_entity_links.evidence_count + EXCLUDED.evidence_count,
                weight = GREATEST(vanguard_entity_links.weight, EXCLUDED.weight),
                last_seen = GREATEST(vanguard_entity_links.last_seen, EXCLUDED.last_seen);
        END LOOP;

        -- SOFT-DEPRECATE THE LOSER LINKS (trigger will automatically deprecate corresponding claims)
        UPDATE public.vanguard_entity_links
        SET status = 'deprecated',
            valid_until = now()
        WHERE user_id = r.user_id 
          AND status = 'active'
          AND (source_entity = r.loser OR target_entity = r.loser);
    END LOOP;

    -- 2. TEMPORAL STATUS TRANSITIONS
    -- a. Mark 'current' facts older than 30 days that have provenance as 'historical'
    UPDATE public.vanguard_entity_links
    SET temporal_status = 'historical'
    WHERE temporal_status = 'current'
      AND status = 'active'
      AND source_episode_id IS NOT NULL
      AND (
        last_seen < CURRENT_DATE - 30 
        OR coalesce(valid_from, created_at, now()) < now() - interval '30 days'
      );

    -- b. Mark 'unknown' links older than 60 days as 'stale'
    UPDATE public.vanguard_entity_links
    SET temporal_status = 'stale'
    WHERE temporal_status = 'unknown'
      AND (
        last_seen < CURRENT_DATE - 60 
        OR coalesce(valid_from, created_at, now()) < now() - interval '60 days'
      );

    -- c. Sync deprecated status to historical (if not already historical/stale)
    UPDATE public.vanguard_entity_links
    SET temporal_status = 'historical'
    WHERE status = 'deprecated'
      AND temporal_status NOT IN ('historical', 'stale');

    -- d. Ensure active hypothesis memory types are marked as hypothesis
    UPDATE public.vanguard_entity_links
    SET temporal_status = 'hypothesis'
    WHERE memory_type = 'hypothesis'
      AND status = 'active'
      AND temporal_status != 'hypothesis';
END;
$$;

ALTER FUNCTION public.vanguard_graph_cleanup() SET search_path = public, pg_temp;

-- 2. Redefine get_vanguard_graph_context to query from claims as Single Source of Truth
CREATE OR REPLACE FUNCTION public.get_vanguard_graph_context(
  start_entities text[],
  max_depth integer DEFAULT 2,
  user_id_param uuid DEFAULT NULL::uuid,
  p_layer text DEFAULT NULL::text,
  p_include_historical boolean DEFAULT false,
  p_as_of timestamp with time zone DEFAULT now(),
  p_min_confidence double precision DEFAULT 0.0
) RETURNS TABLE(
  source_entity text,
  relation text,
  target_entity text,
  depth integer,
  path text[],
  evidence_count integer,
  confidence_score double precision,
  status text,
  layer text,
  fact_text text
)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE seeds AS (
    -- Resolve start entities names to their canonical names
    SELECT DISTINCT e.canonical_name AS entity
    FROM unnest(start_entities) AS se
    JOIN public.entities e ON e.user_id = user_id_param 
      AND (lower(e.canonical_name) = lower(trim(se)) 
           OR e.id IN (SELECT entity_id FROM public.entity_aliases WHERE lower(alias) = lower(trim(se))))
  ),
  graph_path AS (
    SELECT
      es.canonical_name AS source_entity,
      r.name AS relation,
      eo.canonical_name AS target_entity,
      1 AS depth,
      ARRAY[es.canonical_name, eo.canonical_name] AS path,
      c.evidence_count,
      c.weight AS confidence_score,
      c.status,
      (c.metadata->>'layer')::text AS layer,
      c.fact_text
    FROM public.claims c
    JOIN public.entities es ON c.subject_id = es.id
    JOIN public.relations r ON c.relation_id = r.id
    JOIN public.entities eo ON c.object_id = eo.id
    WHERE c.user_id = user_id_param
      AND (es.canonical_name IN (SELECT entity FROM seeds) OR eo.canonical_name IN (SELECT entity FROM seeds))
      AND c.evidence_count >= 1
      AND coalesce(c.weight, 0.0) >= p_min_confidence
      AND (p_layer IS NULL OR (c.metadata->>'layer')::text = p_layer)
      AND (
        p_include_historical OR (
          c.status = 'active'
          AND c.epistemic_status IN ('fact', 'preference', 'prediction')
          AND c.valid_from <= p_as_of
          AND (c.valid_to IS NULL OR c.valid_to > p_as_of)
        )
      )
    UNION ALL
    SELECT
      es.canonical_name AS source_entity,
      r.name AS relation,
      eo.canonical_name AS target_entity,
      gp.depth + 1,
      gp.path || eo.canonical_name AS path,
      c.evidence_count,
      c.weight AS confidence_score,
      c.status,
      (c.metadata->>'layer')::text AS layer,
      c.fact_text
    FROM public.claims c
    JOIN public.entities es ON c.subject_id = es.id
    JOIN public.relations r ON c.relation_id = r.id
    JOIN public.entities eo ON c.object_id = eo.id
    JOIN graph_path gp ON (es.canonical_name = gp.target_entity OR eo.canonical_name = gp.source_entity)
    WHERE c.user_id = user_id_param
      AND gp.depth < max_depth
      AND c.evidence_count >= 1
      AND coalesce(c.weight, 0.0) >= p_min_confidence
      AND (p_layer IS NULL OR (c.metadata->>'layer')::text = p_layer)
      AND NOT (eo.canonical_name = ANY(gp.path))
      AND (
        p_include_historical OR (
          c.status = 'active'
          AND c.epistemic_status IN ('fact', 'preference', 'prediction')
          AND c.valid_from <= p_as_of
          AND (c.valid_to IS NULL OR c.valid_to > p_as_of)
        )
      )
  ),
  deduped AS (
    SELECT DISTINCT ON (gp.source_entity, gp.relation, gp.target_entity)
      gp.source_entity, gp.relation, gp.target_entity,
      gp.depth, gp.path, gp.evidence_count, gp.confidence_score, gp.status, gp.layer, gp.fact_text
    FROM graph_path gp
    ORDER BY gp.source_entity, gp.relation, gp.target_entity, gp.depth ASC, gp.evidence_count DESC
  )
  SELECT
    d.source_entity, d.relation, d.target_entity,
    d.depth, d.path, d.evidence_count, d.confidence_score, d.status, d.layer, d.fact_text
  FROM deduped d
  ORDER BY
    CASE WHEN d.source_entity IN (SELECT entity FROM seeds) OR d.target_entity IN (SELECT entity FROM seeds) THEN 0 ELSE 1 END,
    d.depth ASC, d.evidence_count DESC, coalesce(d.confidence_score, 0.0) DESC,
    d.source_entity, d.relation, d.target_entity;
END;
$$;

-- 3. Redefine search_entity_links to query from claims as Single Source of Truth
CREATE OR REPLACE FUNCTION public.search_entity_links(
  query_embedding public.vector,
  match_user_id uuid,
  match_count integer DEFAULT 15
) RETURNS TABLE(
  source_entity text,
  relation text,
  target_entity text,
  source_type text,
  target_type text,
  evidence_count integer,
  similarity double precision,
  confidence_score double precision,
  fact_text text,
  memory_type text
)
LANGUAGE sql
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    es.canonical_name AS source_entity,
    r.name AS relation,
    eo.canonical_name AS target_entity,
    es.kind AS source_type,
    eo.kind AS target_type,
    c.evidence_count,
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.weight AS confidence_score,
    c.fact_text,
    CASE WHEN c.epistemic_status = 'fact' THEN 'declared' ELSE c.epistemic_status END AS memory_type
  FROM public.claims c
  JOIN public.entities es ON c.subject_id = es.id
  JOIN public.relations r ON c.relation_id = r.id
  JOIN public.entities eo ON c.object_id = eo.id
  WHERE c.user_id = match_user_id
    AND c.embedding IS NOT NULL
    AND c.status = 'active'
    AND c.epistemic_status IN ('fact', 'preference', 'prediction')
    AND c.valid_from <= now()
    AND (c.valid_to IS NULL OR c.valid_to > now())
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 4. Redefine search_entity_links_fulltext to query from claims as Single Source of Truth
CREATE OR REPLACE FUNCTION public.search_entity_links_fulltext(
  query_text text,
  match_user_id uuid,
  match_count integer DEFAULT 15
) RETURNS TABLE(
  source_entity text,
  relation text,
  target_entity text,
  source_type text,
  target_type text,
  fact_text text,
  evidence_count integer,
  rank real
)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    es.canonical_name AS source_entity,
    r.name AS relation,
    eo.canonical_name AS target_entity,
    es.kind AS source_type,
    eo.kind AS target_type,
    c.fact_text,
    c.evidence_count,
    ts_rank(to_tsvector('simple', COALESCE(c.fact_text, '')),
            plainto_tsquery('simple', query_text)) AS rank
  FROM public.claims c
  JOIN public.entities es ON c.subject_id = es.id
  JOIN public.relations r ON c.relation_id = r.id
  JOIN public.entities eo ON c.object_id = eo.id
  WHERE c.user_id = match_user_id
    AND c.status = 'active'
    AND c.epistemic_status IN ('fact', 'preference', 'prediction')
    AND c.valid_from <= now()
    AND (c.valid_to IS NULL OR c.valid_to > now())
    AND to_tsvector('simple', COALESCE(c.fact_text, '')) @@ plainto_tsquery('simple', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$;

-- 5. Revoke execute permissions on critical RPCs from public and anon
REVOKE EXECUTE ON FUNCTION public.get_desktop_dashboard_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_desktop_dashboard_data(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_vanguard_graph_context(text[], integer, uuid, text, boolean, timestamp with time zone, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vanguard_graph_context(text[], integer, uuid, text, boolean, timestamp with time zone, double precision) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.search_entity_links(public.vector, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_entity_links(public.vector, uuid, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.search_entity_links_fulltext(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_entity_links_fulltext(text, uuid, integer) TO authenticated, service_role;
