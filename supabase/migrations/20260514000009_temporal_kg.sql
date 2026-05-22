-- =====================================================
-- TEMPORAL KG ACTIVATION (Graphiti pattern)
-- 2026-05-14
-- =====================================================

-- 1. source_episode_id — provenance: z którego wpisu stream pochodzi fakt
ALTER TABLE public.vanguard_entity_links
  ADD COLUMN IF NOT EXISTS source_episode_id uuid;

-- 2. Singleton relations — relacje gdzie podmiot może mieć tylko jeden aktywny cel
CREATE TABLE IF NOT EXISTS public.vanguard_singleton_relations (
  relation    text PRIMARY KEY,
  description text
);

INSERT INTO public.vanguard_singleton_relations (relation, description) VALUES
  ('pracuje_w',           'Osoba pracuje aktualnie w jednym miejscu'),
  ('jest_zatrudniony_w',  'Alias dla pracuje_w'),
  ('mieszka_w',           'Osoba mieszka w jednym miejscu naraz'),
  ('studiuje_na',         'Osoba studiuje na jednej uczelni'),
  ('uczęszcza_do',        'Uczęszcza aktywnie do jednego miejsca'),
  ('jest_w_związku_z',    'Osoba jest w jednym romantycznym związku'),
  ('ma_wiek',             'Wiek jest unikalny dla osoby'),
  ('pełni_rolę',          'Aktualna rola zawodowa — jedna naraz'),
  ('jest_liderem_w',      'Rola lidera jest jednostkowa'),
  ('ma_aktywny_cel',      'Aktywny główny cel — nadpisywany nowym')
ON CONFLICT DO NOTHING;

-- 3. Fix search_entity_links: tylko aktywne i temporalnie ważne
CREATE OR REPLACE FUNCTION public.search_entity_links(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_count     int DEFAULT 20
) RETURNS TABLE (
  source_entity  text,
  relation       text,
  target_entity  text,
  source_type    text,
  target_type    text,
  evidence_count int,
  similarity     float
) LANGUAGE sql STABLE AS $$
  SELECT
    el.source_entity,
    el.relation,
    el.target_entity,
    el.source_type,
    el.target_type,
    el.evidence_count,
    1 - (el.embedding <=> query_embedding) AS similarity
  FROM public.vanguard_entity_links el
  WHERE el.user_id = match_user_id
    AND el.embedding IS NOT NULL
    AND el.status = 'active'
    AND (el.valid_until IS NULL OR el.valid_until > now())
  ORDER BY el.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 4. Nowy upsert_vanguard_entity_link z:
--    - singleton superseding (Graphiti pattern)
--    - provenance (source_episode_id)
--    - correct valid_from (data oryginalnego wpisu, nie now())
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

  -- Sprawdź czy relacja jest singletonem
  SELECT EXISTS(
    SELECT 1 FROM public.vanguard_singleton_relations WHERE relation = v_relation
  ) INTO v_is_singleton;

  -- GRAPHITI PATTERN: zdeprecjonuj stare aktywne linki z innym targetem
  IF v_is_singleton THEN
    UPDATE public.vanguard_entity_links
    SET
      status        = 'deprecated',
      valid_until   = v_obs_at,
      superseded_by = v_new_id,
      metadata      = metadata || jsonb_build_object(
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
    confidence_score, memory_type, layer, metadata, source_episode_id
  ) VALUES (
    v_new_id, p_user_id,
    v_source, v_source_type, v_relation, v_target, v_target_type,
    1.0, 1, CURRENT_DATE, CURRENT_DATE, v_obs_at, v_obs_at, 'active',
    v_confidence, v_memory_type, v_layer,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('last_upserted_at', now()),
    p_source_episode_id
  )
  ON CONFLICT (user_id, source_entity, relation, target_entity) DO UPDATE SET
    evidence_count    = public.vanguard_entity_links.evidence_count + 1,
    weight            = LEAST(5.0, public.vanguard_entity_links.weight + 0.2),
    last_seen         = CURRENT_DATE,
    observed_at       = v_obs_at,
    status            = CASE
                          WHEN public.vanguard_entity_links.status = 'deprecated' THEN 'active'
                          ELSE public.vanguard_entity_links.status
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

-- 5. Backfill: valid_from = first_seen dla istniejących rekordów (bez nadpisywania)
UPDATE public.vanguard_entity_links
SET valid_from = (first_seen::timestamptz)
WHERE valid_from IS NULL AND first_seen IS NOT NULL;
