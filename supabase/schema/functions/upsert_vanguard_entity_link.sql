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
