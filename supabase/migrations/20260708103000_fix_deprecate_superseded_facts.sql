-- ============================================================
-- VANGUARD OS — FIX: DEPRECATE SUPERSEDED FACTS
-- ============================================================

CREATE OR REPLACE FUNCTION public.deprecate_superseded_facts(
  p_user_id uuid,
  p_source text,
  p_relation text,
  p_new_target text,
  p_new_confidence double precision,
  p_new_episode_id uuid DEFAULT NULL::uuid
) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_deprecated_count int := 0;
BEGIN
  IF p_new_confidence < 0.80 THEN
    RETURN 0;
  END IF;

  -- Sprawdzamy czy relacja jest singletonem w nowej tabeli public.relations
  IF NOT EXISTS (
    SELECT 1
    FROM public.relations
    WHERE name = p_relation AND is_singleton = true
  ) THEN
    RETURN 0;
  END IF;

  UPDATE public.vanguard_entity_links
  SET
    status          = 'deprecated',
    temporal_status = 'historical', -- superseded fact becomes historical
    valid_until     = now(),
    metadata        = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
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
