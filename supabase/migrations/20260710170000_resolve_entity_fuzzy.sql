-- ============================================================
-- VANGUARD OS — FUZZY ENTITY RESOLUTION HELPER (TIER 1)
-- ============================================================

-- Drop functions first to avoid signature changes conflict
DROP FUNCTION IF EXISTS public.resolve_entity_fuzzy_candidates(uuid, text, text);
DROP FUNCTION IF EXISTS public.resolve_entity(uuid, text, text);
DROP FUNCTION IF EXISTS public.resolve_entity_decision(uuid, text, text, double precision, double precision, double precision);

-- A. Create GIN index for trigram similarity searches on entity aliases
CREATE INDEX IF NOT EXISTS idx_entity_aliases_alias_trgm 
ON public.entity_aliases 
USING gin (alias public.gin_trgm_ops);

-- B. Create resolve_entity_decision function as Single Source of Truth
CREATE OR REPLACE FUNCTION public.resolve_entity_decision(
  p_user_id uuid,
  p_name text,
  p_kind text,
  p_threshold_same double precision DEFAULT 0.7,
  p_threshold_diff double precision DEFAULT 0.85,
  p_gap double precision DEFAULT 0.15
) RETURNS uuid AS $$
DECLARE
  v_entity_uuid uuid;
  v_clean_name text;
  v_best_id uuid;
  v_best_sim double precision;
  v_second_id uuid;
  v_second_sim double precision;
BEGIN
  v_clean_name := trim(p_name);

  -- 1. Try exact case-insensitive match on aliases first (highest priority, kind same)
  SELECT ea.entity_id INTO v_entity_uuid
  FROM public.entity_aliases ea
  JOIN public.entities e ON ea.entity_id = e.id
  WHERE e.user_id = p_user_id 
    AND lower(ea.alias) = lower(v_clean_name)
    AND e.kind = p_kind
  LIMIT 1;

  -- 2. Try exact case-insensitive match on canonical names (kind same)
  IF v_entity_uuid IS NULL THEN
    SELECT id INTO v_entity_uuid
    FROM public.entities
    WHERE user_id = p_user_id 
      AND lower(canonical_name) = lower(v_clean_name)
      AND kind = p_kind
    LIMIT 1;
  END IF;

  -- 3. Try exact case-insensitive match on aliases (any kind)
  IF v_entity_uuid IS NULL THEN
    SELECT ea.entity_id INTO v_entity_uuid
    FROM public.entity_aliases ea
    JOIN public.entities e ON ea.entity_id = e.id
    WHERE e.user_id = p_user_id 
      AND lower(ea.alias) = lower(v_clean_name)
    ORDER BY (e.kind = p_kind) DESC -- prefer same kind
    LIMIT 1;
  END IF;

  -- 4. Fuzzy trigram similarity search (Soft kind-match with confidence gap and RLS/Audit logging)
  IF v_entity_uuid IS NULL THEN
    -- Fetch top candidate above threshold
    SELECT entity_id, sim INTO v_best_id, v_best_sim
    FROM (
      SELECT ea.entity_id, similarity(ea.alias, v_clean_name) AS sim
      FROM public.entity_aliases ea
      JOIN public.entities e ON e.id = ea.entity_id
      WHERE e.user_id = p_user_id
        AND (
          (e.kind = p_kind AND similarity(ea.alias, v_clean_name) >= p_threshold_same) OR
          (e.kind <> p_kind AND similarity(ea.alias, v_clean_name) >= p_threshold_diff)
        )
    ) q
    ORDER BY sim DESC
    LIMIT 1;

    IF v_best_id IS NOT NULL THEN
      -- Fetch second candidate above threshold (with different entity_id)
      SELECT entity_id, sim INTO v_second_id, v_second_sim
      FROM (
        SELECT ea.entity_id, similarity(ea.alias, v_clean_name) AS sim
        FROM public.entity_aliases ea
        JOIN public.entities e ON e.id = ea.entity_id
        WHERE e.user_id = p_user_id
          AND ea.entity_id <> v_best_id
          AND (
            (e.kind = p_kind AND similarity(ea.alias, v_clean_name) >= p_threshold_same) OR
            (e.kind <> p_kind AND similarity(ea.alias, v_clean_name) >= p_threshold_diff)
          )
      ) q
      ORDER BY sim DESC
      LIMIT 1;

      -- Check gap
      IF v_second_id IS NULL OR (v_best_sim - v_second_sim >= p_gap) THEN
        v_entity_uuid := v_best_id;
      ELSE
        -- Gap check failed: log ambiguous fuzzy match to audit_events
        INSERT INTO public.audit_events (event_type, severity, message, user_id, related_table, metadata)
        VALUES (
          'entity_fuzzy_ambiguous',
          'warning',
          'Fuzzy resolution failed confidence gap check for name: "' || v_clean_name || '" (best sim: ' || v_best_sim || ', second sim: ' || v_second_sim || ', gap limit: ' || p_gap || ')',
          p_user_id,
          'entities',
          jsonb_build_object(
            'name', v_clean_name,
            'extracted_kind', p_kind,
            'best_id', v_best_id,
            'best_sim', v_best_sim,
            'second_id', v_second_id,
            'second_sim', v_second_sim
          )
        );
      END IF;
    END IF;
  END IF;

  -- 5. Follow merged_into reference recursively if the entity was merged
  IF v_entity_uuid IS NOT NULL THEN
    WHILE EXISTS (SELECT 1 FROM public.entities WHERE id = v_entity_uuid AND merged_into IS NOT NULL) LOOP
      SELECT merged_into INTO v_entity_uuid
      FROM public.entities
      WHERE id = v_entity_uuid;
    END LOOP;
  END IF;

  RETURN v_entity_uuid;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.resolve_entity_decision(uuid, text, text, double precision, double precision, double precision) SET search_path = public, pg_temp;

-- C. Recreate resolve_entity using decision helper (Trigger path)
CREATE OR REPLACE FUNCTION public.resolve_entity(
  p_user_id uuid,
  p_name text,
  p_kind text
) RETURNS uuid AS $$
DECLARE
  v_entity_uuid uuid;
  v_clean_name text;
BEGIN
  v_clean_name := trim(p_name);
  
  -- Call decision function
  v_entity_uuid := public.resolve_entity_decision(p_user_id, v_clean_name, p_kind);

  -- If not found, create new entity
  IF v_entity_uuid IS NULL THEN
    INSERT INTO public.entities (user_id, canonical_name, kind)
    VALUES (p_user_id, v_clean_name, p_kind)
    RETURNING id INTO v_entity_uuid;
  END IF;

  -- Follow merged_into reference recursively if the entity was merged
  WHILE EXISTS (SELECT 1 FROM public.entities WHERE id = v_entity_uuid AND merged_into IS NOT NULL) LOOP
    SELECT merged_into INTO v_entity_uuid
    FROM public.entities
    WHERE id = v_entity_uuid;
  END LOOP;

  RETURN v_entity_uuid;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.resolve_entity(uuid, text, text) SET search_path = public, pg_temp;

-- D. Recreate resolve_entity_fuzzy_candidates (Soft kind-match candidates retrieval)
CREATE OR REPLACE FUNCTION public.resolve_entity_fuzzy_candidates(
  p_user_id uuid,
  p_name text,
  p_kind text
) RETURNS TABLE(
  entity_id uuid,
  canonical_name text,
  alias text,
  sim double precision,
  kind text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ea.entity_id,
    e.canonical_name,
    ea.alias,
    similarity(ea.alias, trim(p_name))::double precision AS sim,
    e.kind
  FROM public.entity_aliases ea
  JOIN public.entities e ON e.id = ea.entity_id
  WHERE e.user_id = p_user_id
    AND similarity(ea.alias, trim(p_name)) > 0.3
  ORDER BY sim DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.resolve_entity_fuzzy_candidates(uuid, text, text) SET search_path = public, pg_temp;
