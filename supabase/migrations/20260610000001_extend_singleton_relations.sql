-- =====================================================
-- EXTEND SINGLETON RELATIONS + CONFIDENCE-BASED SUPERSEDING
-- 2026-06-10
-- Context: upsert_vanguard_entity_link already handles deprecation
-- for relations in vanguard_singleton_relations. This migration:
-- 1. Extends the singleton table with role/state/goal relations
--    that are naturally exclusive (person can't hold two simultaneous roles)
-- 2. Adds a helper function for high-confidence fact superseding
--    (catches non-singleton relations when confidence >= 0.8)
-- =====================================================

-- 1. Extend singleton relations to cover career/state transitions
INSERT INTO public.vanguard_singleton_relations (relation, description) VALUES
  ('jest',           'Aktualna rola/tożsamość — jedna naraz (np. setter, student)'),
  ('ma_role',        'Alias dla jest — rola zawodowa'),
  ('uczestniczy_w',  'Aktywny udział — jeden kontekst naraz'),
  ('studiuje',       'Aktywny kierunek studiów — jeden naraz'),
  ('pracuje_nad',    'Aktualny główny projekt — jeden naraz')
ON CONFLICT DO NOTHING;

-- 2. Function: deprecate high-confidence superseding facts
-- Called by vanguard-architect when a new high-confidence fact (>= 0.80)
-- arrives for the same (source, relation) but different target.
-- Unlike singleton superseding, this is for non-singleton relations
-- where we have strong new evidence overriding an older observation.
-- Safety: only deprecates facts, never hypotheses; only active records.
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
  -- Only act when new confidence is high (>= 0.80) — weak signals don't supersede
  IF p_new_confidence < 0.80 THEN
    RETURN 0;
  END IF;

  -- Deprecate older active facts with same (user, source, relation) but different target
  -- Conditions:
  --   • status = 'active' (not already deprecated/quarantined)
  --   • memory_type = 'fact' (never deprecate hypotheses via this path)
  --   • valid_until IS NULL (still temporally valid)
  --   • confidence_score < p_new_confidence - 0.05 (new is meaningfully stronger)
  --   • target_entity != p_new_target (actual conflict)
  UPDATE public.vanguard_entity_links
  SET
    status        = 'deprecated',
    valid_until   = now(),
    metadata      = metadata || jsonb_build_object(
                      'deprecated_reason',   'high_confidence_superseding',
                      'deprecated_at',       now(),
                      'superseded_by_episode', p_new_episode_id,
                      'new_target',          p_new_target
                    )
  WHERE
    user_id         = p_user_id
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

-- 3. Index for efficient deprecation queries
CREATE INDEX IF NOT EXISTS idx_vel_deprecation_lookup
  ON public.vanguard_entity_links (user_id, source_entity, relation, status)
  WHERE status = 'active' AND valid_until IS NULL;
