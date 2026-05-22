-- VANGUARD OS - GRAPH ENTITY RESOLUTION & TEMPORAL EDGES
-- Cel:
-- 1. Kanonizacja encji typu Jakub/Uzytkownik/Osoba/person/student -> Jakub.
-- 2. Dodanie osi czasu, statusu, confidence i metadata do krawedzi grafu.
-- 3. Naprawa upsertu/traversalu tak, aby graf byl realna warstwa prawdy.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.vanguard_entity_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  alias text NOT NULL,
  canonical text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, alias)
);

ALTER TABLE public.vanguard_entity_aliases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Users own entity aliases'
  ) THEN
    CREATE POLICY "Users own entity aliases"
    ON public.vanguard_entity_aliases
    FOR ALL
    USING ((select auth.uid()) = user_id);
  END IF;
END $$;

ALTER TABLE public.vanguard_entity_links
ADD COLUMN IF NOT EXISTS valid_from timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS valid_until timestamptz,
ADD COLUMN IF NOT EXISTS observed_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS confidence_score double precision DEFAULT 0.6,
ADD COLUMN IF NOT EXISTS memory_type text DEFAULT 'fact',
ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.vanguard_entity_links(id),
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vanguard_entity_links_status_check'
  ) THEN
    ALTER TABLE public.vanguard_entity_links
    ADD CONSTRAINT vanguard_entity_links_status_check
    CHECK (status IN ('active', 'historical', 'disputed', 'deprecated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vanguard_entity_links_memory_type_check'
  ) THEN
    ALTER TABLE public.vanguard_entity_links
    ADD CONSTRAINT vanguard_entity_links_memory_type_check
    CHECK (memory_type IN ('fact', 'hypothesis', 'preference', 'correlation', 'telemetry'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vanguard_entity_links_confidence_check'
  ) THEN
    ALTER TABLE public.vanguard_entity_links
    ADD CONSTRAINT vanguard_entity_links_confidence_check
    CHECK (confidence_score >= 0 AND confidence_score <= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_entity_links_active_lookup
ON public.vanguard_entity_links(user_id, status, layer, source_entity, target_entity)
WHERE valid_until IS NULL;

CREATE INDEX IF NOT EXISTS idx_entity_links_metadata
ON public.vanguard_entity_links USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_entity_aliases_user_alias
ON public.vanguard_entity_aliases(user_id, lower(alias));

CREATE OR REPLACE FUNCTION public.canonicalize_vanguard_entity(
  p_user_id uuid,
  p_name text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_lower text := lower(btrim(coalesce(p_name, '')));
  v_canonical text;
BEGIN
  IF v_name = '' THEN
    RETURN v_name;
  END IF;

  SELECT a.canonical INTO v_canonical
  FROM public.vanguard_entity_aliases a
  WHERE a.user_id = p_user_id
    AND lower(a.alias) = v_lower
  LIMIT 1;

  IF v_canonical IS NOT NULL THEN
    RETURN v_canonical;
  END IF;

  IF v_lower IN (
    'jakub', 'uzytkownik', 'użytkownik', 'uzytkownika', 'użytkownika',
    'osoba', 'person', 'student', 'user', 'ja', 'mnie', 'mi', 'mną', 'mna'
  ) THEN
    RETURN 'Jakub';
  END IF;

  RETURN v_name;
END;
$$;

-- Seed aliases for every existing graph user.
INSERT INTO public.vanguard_entity_aliases(user_id, alias, canonical, reason)
SELECT u.user_id, alias_value, 'Jakub', 'self canonical seed'
FROM (
  SELECT DISTINCT user_id FROM public.vanguard_entity_links WHERE user_id IS NOT NULL
) u
CROSS JOIN (
  VALUES
    ('Jakub'),
    ('Uzytkownik'),
    ('Użytkownik'),
    ('Uzytkownika'),
    ('Użytkownika'),
    ('Osoba'),
    ('person'),
    ('student'),
    ('user'),
    ('ja'),
    ('mnie'),
    ('mi')
) aliases(alias_value)
ON CONFLICT (user_id, alias) DO UPDATE
SET canonical = EXCLUDED.canonical,
    reason = EXCLUDED.reason;

-- Merge existing dirty self nodes into canonical Jakub.
WITH normalized AS (
  SELECT
    l.user_id,
    public.canonicalize_vanguard_entity(l.user_id, l.source_entity) AS source_entity,
    CASE
      WHEN public.canonicalize_vanguard_entity(l.user_id, l.source_entity) = 'Jakub' THEN 'person'
      ELSE l.source_type
    END AS source_type,
    l.relation,
    public.canonicalize_vanguard_entity(l.user_id, l.target_entity) AS target_entity,
    CASE
      WHEN public.canonicalize_vanguard_entity(l.user_id, l.target_entity) = 'Jakub' THEN 'person'
      ELSE l.target_type
    END AS target_type,
    max(l.weight) AS weight,
    sum(coalesce(l.evidence_count, 1))::integer AS evidence_count,
    min(l.first_seen) AS first_seen,
    max(l.last_seen) AS last_seen,
    min(coalesce(l.created_at, now())) AS created_at,
    coalesce(l.layer, 'intelligence') AS layer,
    min(coalesce(l.valid_from, l.created_at, now())) AS valid_from,
    max(l.observed_at) AS observed_at,
    max(coalesce(l.confidence_score, 0.6)) AS confidence_score,
    CASE
      WHEN bool_or(l.memory_type = 'hypothesis') THEN 'hypothesis'
      WHEN bool_or(l.memory_type = 'correlation') THEN 'correlation'
      WHEN bool_or(l.memory_type = 'telemetry') THEN 'telemetry'
      ELSE 'fact'
    END AS memory_type,
    jsonb_build_object(
      'canonicalized_at', now(),
      'canonicalization', 'self_alias_merge'
    ) AS metadata
  FROM public.vanguard_entity_links l
  WHERE public.canonicalize_vanguard_entity(l.user_id, l.source_entity) <> l.source_entity
     OR public.canonicalize_vanguard_entity(l.user_id, l.target_entity) <> l.target_entity
  GROUP BY
    l.user_id,
    public.canonicalize_vanguard_entity(l.user_id, l.source_entity),
    CASE WHEN public.canonicalize_vanguard_entity(l.user_id, l.source_entity) = 'Jakub' THEN 'person' ELSE l.source_type END,
    l.relation,
    public.canonicalize_vanguard_entity(l.user_id, l.target_entity),
    CASE WHEN public.canonicalize_vanguard_entity(l.user_id, l.target_entity) = 'Jakub' THEN 'person' ELSE l.target_type END,
    coalesce(l.layer, 'intelligence')
)
INSERT INTO public.vanguard_entity_links (
  user_id, source_entity, source_type, relation, target_entity, target_type,
  weight, evidence_count, first_seen, last_seen, created_at, layer,
  valid_from, observed_at, status, confidence_score, memory_type, metadata
)
SELECT
  user_id, source_entity, source_type, relation, target_entity, target_type,
  weight, evidence_count, first_seen, last_seen, created_at, layer,
  valid_from, observed_at, 'active', confidence_score, memory_type, metadata
FROM normalized
WHERE source_entity <> target_entity
ON CONFLICT (user_id, source_entity, relation, target_entity)
DO UPDATE SET
  evidence_count = public.vanguard_entity_links.evidence_count + EXCLUDED.evidence_count,
  weight = GREATEST(public.vanguard_entity_links.weight, EXCLUDED.weight),
  first_seen = LEAST(public.vanguard_entity_links.first_seen, EXCLUDED.first_seen),
  last_seen = GREATEST(public.vanguard_entity_links.last_seen, EXCLUDED.last_seen),
  observed_at = GREATEST(public.vanguard_entity_links.observed_at, EXCLUDED.observed_at),
  confidence_score = GREATEST(public.vanguard_entity_links.confidence_score, EXCLUDED.confidence_score),
  metadata = public.vanguard_entity_links.metadata || EXCLUDED.metadata;

DELETE FROM public.vanguard_entity_links l
WHERE public.canonicalize_vanguard_entity(l.user_id, l.source_entity) <> l.source_entity
   OR public.canonicalize_vanguard_entity(l.user_id, l.target_entity) <> l.target_entity;

CREATE OR REPLACE FUNCTION public.upsert_vanguard_entity_link(
  p_user_id uuid,
  p_source text,
  p_source_type text,
  p_relation text,
  p_target text,
  p_target_type text,
  p_confidence_score double precision DEFAULT 0.6,
  p_memory_type text DEFAULT 'fact',
  p_layer text DEFAULT 'intelligence',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source text := public.canonicalize_vanguard_entity(p_user_id, p_source);
  v_target text := public.canonicalize_vanguard_entity(p_user_id, p_target);
  v_relation text := btrim(coalesce(p_relation, ''));
  v_source_type text := coalesce(nullif(btrim(p_source_type), ''), 'unknown');
  v_target_type text := coalesce(nullif(btrim(p_target_type), ''), 'unknown');
  v_confidence double precision := greatest(0, least(1, coalesce(p_confidence_score, 0.6)));
  v_memory_type text := coalesce(nullif(p_memory_type, ''), 'fact');
  v_layer text := coalesce(nullif(p_layer, ''), 'intelligence');
BEGIN
  IF v_source = '' OR v_target = '' OR v_relation = '' OR v_source = v_target THEN
    RETURN;
  END IF;

  IF v_source = 'Jakub' THEN v_source_type := 'person'; END IF;
  IF v_target = 'Jakub' THEN v_target_type := 'person'; END IF;

  IF v_memory_type NOT IN ('fact', 'hypothesis', 'preference', 'correlation', 'telemetry') THEN
    v_memory_type := 'fact';
  END IF;

  INSERT INTO public.vanguard_entity_links (
    user_id, source_entity, source_type, relation, target_entity, target_type,
    weight, evidence_count, first_seen, last_seen, observed_at, status,
    confidence_score, memory_type, layer, metadata
  )
  VALUES (
    p_user_id, v_source, v_source_type, v_relation, v_target, v_target_type,
    1.0, 1, CURRENT_DATE, CURRENT_DATE, now(), 'active',
    v_confidence, v_memory_type, v_layer,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('last_upserted_at', now())
  )
  ON CONFLICT (user_id, source_entity, relation, target_entity)
  DO UPDATE SET
    evidence_count = public.vanguard_entity_links.evidence_count + 1,
    weight = LEAST(5.0, public.vanguard_entity_links.weight + 0.2),
    last_seen = CURRENT_DATE,
    observed_at = now(),
    status = CASE
      WHEN public.vanguard_entity_links.status = 'deprecated' THEN 'active'
      ELSE public.vanguard_entity_links.status
    END,
    valid_until = NULL,
    confidence_score = GREATEST(public.vanguard_entity_links.confidence_score, EXCLUDED.confidence_score),
    memory_type = CASE
      WHEN public.vanguard_entity_links.memory_type = 'fact' THEN 'fact'
      ELSE EXCLUDED.memory_type
    END,
    layer = EXCLUDED.layer,
    metadata = public.vanguard_entity_links.metadata || EXCLUDED.metadata;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_mentioned_entities(
  query_text text,
  user_id_param uuid
)
RETURNS TABLE (entity_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text := lower(coalesce(query_text, ''));
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT source_entity AS name FROM public.vanguard_entity_links WHERE user_id = user_id_param
    UNION
    SELECT target_entity AS name FROM public.vanguard_entity_links WHERE user_id = user_id_param
    UNION
    SELECT alias AS name FROM public.vanguard_entity_aliases WHERE user_id = user_id_param
  ),
  matched AS (
    SELECT DISTINCT public.canonicalize_vanguard_entity(user_id_param, c.name) AS canonical_name
    FROM candidates c
    WHERE v_query ILIKE '%' || lower(c.name) || '%'
       OR similarity(v_query, lower(c.name)) > 0.35
  )
  SELECT canonical_name
  FROM matched
  WHERE canonical_name IS NOT NULL AND canonical_name <> '';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vanguard_graph_context(
  start_entities text[],
  max_depth integer DEFAULT 2,
  user_id_param uuid DEFAULT NULL,
  p_layer text DEFAULT 'intelligence',
  p_as_of timestamptz DEFAULT now(),
  p_include_historical boolean DEFAULT false,
  p_min_confidence double precision DEFAULT 0.0
)
RETURNS TABLE (
  source_entity text,
  relation text,
  target_entity text,
  depth integer,
  path text[],
  evidence_count integer,
  confidence_score double precision,
  status text,
  layer text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE seeds AS (
    SELECT DISTINCT public.canonicalize_vanguard_entity(user_id_param, unnest(start_entities)) AS entity
  ),
  graph_path AS (
    SELECT
      l.source_entity,
      l.relation,
      l.target_entity,
      1 AS depth,
      ARRAY[l.source_entity, l.target_entity] AS path,
      l.evidence_count,
      l.confidence_score,
      l.status,
      l.layer
    FROM public.vanguard_entity_links l
    WHERE l.user_id = user_id_param
      AND (l.source_entity IN (SELECT entity FROM seeds) OR l.target_entity IN (SELECT entity FROM seeds))
      AND l.evidence_count >= 1
      AND coalesce(l.confidence_score, 0.0) >= p_min_confidence
      AND (p_layer IS NULL OR l.layer = p_layer)
      AND (
        p_include_historical
        OR (
          l.status = 'active'
          AND coalesce(l.valid_from, l.created_at, now()) <= p_as_of
          AND (l.valid_until IS NULL OR l.valid_until > p_as_of)
        )
      )

    UNION ALL

    SELECT
      l.source_entity,
      l.relation,
      l.target_entity,
      gp.depth + 1,
      gp.path || l.target_entity,
      l.evidence_count,
      l.confidence_score,
      l.status,
      l.layer
    FROM public.vanguard_entity_links l
    JOIN graph_path gp ON (l.source_entity = gp.target_entity OR l.target_entity = gp.source_entity)
    WHERE l.user_id = user_id_param
      AND gp.depth < max_depth
      AND l.evidence_count >= 1
      AND coalesce(l.confidence_score, 0.0) >= p_min_confidence
      AND (p_layer IS NULL OR l.layer = p_layer)
      AND NOT (l.target_entity = ANY(gp.path))
      AND (
        p_include_historical
        OR (
          l.status = 'active'
          AND coalesce(l.valid_from, l.created_at, now()) <= p_as_of
          AND (l.valid_until IS NULL OR l.valid_until > p_as_of)
        )
      )
  )
  , deduped AS (
    SELECT DISTINCT ON (gp.source_entity, gp.relation, gp.target_entity)
      gp.source_entity,
      gp.relation,
      gp.target_entity,
      gp.depth,
      gp.path,
      gp.evidence_count,
      gp.confidence_score,
      gp.status,
      gp.layer
    FROM graph_path gp
    ORDER BY gp.source_entity, gp.relation, gp.target_entity, gp.depth ASC, gp.evidence_count DESC
  )
  SELECT
    d.source_entity,
    d.relation,
    d.target_entity,
    d.depth,
    d.path,
    d.evidence_count,
    d.confidence_score,
    d.status,
    d.layer
  FROM deduped d
  ORDER BY
    CASE
      WHEN d.source_entity IN (SELECT entity FROM seeds) OR d.target_entity IN (SELECT entity FROM seeds) THEN 0
      ELSE 1
    END,
    d.depth ASC,
    d.evidence_count DESC,
    coalesce(d.confidence_score, 0.0) DESC,
    d.source_entity,
    d.relation,
    d.target_entity;
END;
$$;
