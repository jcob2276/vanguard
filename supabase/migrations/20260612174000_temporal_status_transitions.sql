-- ============================================================================
-- MIGRATION: 20260612174000_temporal_status_transitions
-- Purpose:
--   1. Redefine upsert_vanguard_entity_link to dynamically calculate and update
--      temporal_status (reactivating stale/historical links to current).
--      Resolves foreign key constraint violations on reactivation by resolving
--      the actual link ID before setting superseded_by.
--   2. Redefine deprecate_superseded_facts to set temporal_status = 'historical'
--      on superseded links.
--   3. Enhance vanguard_graph_cleanup to run weekly temporal cleanup transitions.
-- ============================================================================

-- 1. Redefine upsert_vanguard_entity_link (12-parameter overload)
CREATE OR REPLACE FUNCTION public.upsert_vanguard_entity_link(
  p_user_id           uuid,
  p_source            text,
  p_source_type       text               DEFAULT NULL,
  p_relation          text               DEFAULT NULL,
  p_target            text               DEFAULT NULL,
  p_target_type       text               DEFAULT NULL,
  p_confidence_score  double precision   DEFAULT NULL,
  p_memory_type       text               DEFAULT NULL,
  p_layer             text               DEFAULT NULL,
  p_metadata          jsonb              DEFAULT NULL,
  p_source_episode_id uuid               DEFAULT NULL,
  p_observed_at       timestamptz        DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_source      text             := public.canonicalize_vanguard_entity(p_user_id, p_source);
  v_target      text             := public.canonicalize_vanguard_entity(p_user_id, p_target);
  v_relation    text             := btrim(coalesce(p_relation, ''));
  v_source_type text             := coalesce(nullif(btrim(p_source_type), ''), 'unknown');
  v_target_type text             := coalesce(nullif(btrim(p_target_type), ''), 'unknown');
  v_confidence  double precision := greatest(0, least(1, coalesce(p_confidence_score, 0.6)));
  v_memory_type text             := coalesce(nullif(p_memory_type, ''), 'fact');
  v_layer       text             := coalesce(nullif(p_layer, ''), 'intelligence');
  v_obs_at      timestamptz      := coalesce(p_observed_at, now());
  v_is_singleton boolean;
  v_new_id      uuid             := gen_random_uuid();
  v_link_id     uuid;
  v_temp_status text;
BEGIN
  -- Walidacja
  IF v_source = '' OR v_target = '' OR v_relation = '' OR v_source = v_target THEN
    RETURN;
  END IF;

  -- Normalizacja typów dla Jakuba
  IF v_source = 'Jakub' THEN v_source_type := 'person'; END IF;
  IF v_target = 'Jakub' THEN v_target_type := 'person'; END IF;

  IF v_memory_type NOT IN ('fact', 'hypothesis', 'preference', 'correlation', 'telemetry') THEN
    v_memory_type := 'fact';
  END IF;

  -- Wyznacz temporal_status na bazie typów i relacji
  IF v_memory_type = 'hypothesis' THEN
    v_temp_status := 'hypothesis';
  ELSIF v_relation = 'deklaruje' THEN
    v_temp_status := 'declared';
  ELSE
    v_temp_status := 'current';
  END IF;

  -- Sprawdź czy relacja jest singletonem
  SELECT EXISTS(
    SELECT 1 FROM public.vanguard_singleton_relations WHERE relation = v_relation
  ) INTO v_is_singleton;

  -- Sprawdź czy wiersz już istnieje, aby użyć jego rzeczywistego ID
  SELECT id INTO v_link_id
  FROM public.vanguard_entity_links
  WHERE user_id = p_user_id
    AND source_entity = v_source
    AND relation = v_relation
    AND target_entity = v_target;

  IF v_link_id IS NULL THEN
    v_link_id := v_new_id;
  END IF;

  -- GRAPHITI PATTERN: zdeprecjonuj stare aktywne linki z innym targetem
  IF v_is_singleton THEN
    UPDATE public.vanguard_entity_links
    SET
      status          = 'deprecated',
      temporal_status = 'historical', -- Zep/Graphiti: superseded fact is historical
      valid_until     = v_obs_at,
      superseded_by   = v_link_id,   -- Używamy v_link_id, który na pewno będzie istniał
      metadata        = metadata || jsonb_build_object(
                          'deprecated_reason', 'superseded by newer fact',
                          'deprecated_at',     now()
                        )
    WHERE
      user_id        = p_user_id
      AND source_entity = v_source
      AND relation      = v_relation
      AND target_entity != v_target
      AND status        = 'active';
  END IF;

  -- Upsert
  INSERT INTO public.vanguard_entity_links (
    id, user_id, source_entity, source_type, relation, target_entity, target_type,
    weight, evidence_count, first_seen, last_seen, observed_at, valid_from, status,
    confidence_score, memory_type, layer, metadata, source_episode_id, temporal_status
  ) VALUES (
    v_link_id, p_user_id,
    v_source, v_source_type, v_relation, v_target, v_target_type,
    1.0, 1, CURRENT_DATE, CURRENT_DATE, v_obs_at, v_obs_at, 'active',
    v_confidence, v_memory_type, v_layer,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('last_upserted_at', now()),
    p_source_episode_id, v_temp_status
  )
  ON CONFLICT (user_id, source_entity, relation, target_entity) DO UPDATE SET
    evidence_count    = public.vanguard_entity_links.evidence_count + 1,
    weight            = LEAST(5.0, public.vanguard_entity_links.weight + 0.2),
    last_seen         = CURRENT_DATE,
    observed_at       = v_obs_at,
    status            = 'active', -- Reactivate if re-observed
    temporal_status   = CASE
                          WHEN EXCLUDED.memory_type = 'hypothesis' THEN 'hypothesis'
                          WHEN public.vanguard_entity_links.relation = 'deklaruje' THEN 'declared'
                          ELSE 'current'
                        END,
    valid_until       = NULL,
    confidence_score  = GREATEST(
                          public.vanguard_entity_links.confidence_score,
                          EXCLUDED.confidence_score
                        ),
    memory_type       = CASE
                          WHEN public.vanguard_entity_links.memory_type = 'fact' THEN 'fact'
                          ELSE EXCLUDED.memory_type
                        END,
    layer             = EXCLUDED.layer,
    source_episode_id = COALESCE(
                          EXCLUDED.source_episode_id,
                          public.vanguard_entity_links.source_episode_id
                        ),
    metadata          = public.vanguard_entity_links.metadata || EXCLUDED.metadata;
END;
$$;

ALTER FUNCTION public.upsert_vanguard_entity_link(uuid, text, text, text, text, text, double precision, text, text, jsonb, uuid, timestamp with time zone) SET search_path = public, pg_temp;


-- 2. Redefine deprecate_superseded_facts to update temporal_status
CREATE OR REPLACE FUNCTION public.deprecate_superseded_facts(
  p_user_id          uuid,
  p_source           text,
  p_relation         text,
  p_new_target       text,
  p_new_confidence   double precision,
  p_new_episode_id   uuid DEFAULT NULL
) RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_deprecated_count int := 0;
BEGIN
  IF p_new_confidence < 0.80 THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vanguard_singleton_relations
    WHERE relation = p_relation
  ) THEN
    RETURN 0;
  END IF;

  UPDATE public.vanguard_entity_links
  SET
    status          = 'deprecated',
    temporal_status = 'historical', -- superseded fact becomes historical
    valid_until     = now(),
    metadata        = metadata || jsonb_build_object(
                        'deprecated_reason',     'singleton_superseding',
                        'deprecated_at',         now(),
                        'superseded_by_episode', p_new_episode_id,
                        'new_target',            p_new_target
                      )
  WHERE
    user_id          = p_user_id
    AND source_entity = p_source
    AND relation      = p_relation
    AND target_entity != p_new_target
    AND status        = 'active'
    AND memory_type   = 'fact'
    AND valid_until   IS NULL
    AND confidence_score < p_new_confidence - 0.05;

  GET DIAGNOSTICS v_deprecated_count = ROW_COUNT;
  RETURN v_deprecated_count;
END;
$$;

ALTER FUNCTION public.deprecate_superseded_facts(uuid, text, text, text, double precision, uuid) SET search_path = public, pg_temp;


-- 3. Enhance vanguard_graph_cleanup to run weekly temporal cleanup transitions
CREATE OR REPLACE FUNCTION public.vanguard_graph_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r RECORD;
    r_source RECORD;
    r_target RECORD;
BEGIN
    -- 1. Entity Resolution (identical to original logic)
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
        -- DLA KAŻDEGO WIERSZA "LOSERA" JAKO SOURCE
        FOR r_source IN (SELECT * FROM public.vanguard_entity_links WHERE user_id = r.user_id AND source_entity = r.loser) LOOP
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

        -- DLA KAŻDEGO WIERSZA "LOSERA" JAKO TARGET
        FOR r_target IN (SELECT * FROM public.vanguard_entity_links WHERE user_id = r.user_id AND target_entity = r.loser) LOOP
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

        -- USUŃ ŚLADY "LOSERA"
        DELETE FROM public.vanguard_entity_links WHERE user_id = r.user_id AND (source_entity = r.loser OR target_entity = r.loser);
    END LOOP;

    -- 2. TEMPORAL STATUS TRANSITIONS (Zep/Graphiti Pattern)
    
    -- a. Mark 'current' facts older than 30 days that have provenance (source_episode_id) as 'historical'
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
