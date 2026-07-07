CREATE OR REPLACE FUNCTION public.sync_vanguard_entity_links_to_claims()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_uuid uuid;
  v_relation_uuid uuid;
  v_object_uuid uuid;
  v_is_singleton boolean;
  v_temp_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.claims WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  -- Resolve/Insert subject entity
  INSERT INTO public.entities (user_id, canonical_name, kind)
  VALUES (NEW.user_id, NEW.source_entity, NEW.source_type)
  ON CONFLICT (user_id, canonical_name) DO UPDATE SET
    kind = EXCLUDED.kind
  RETURNING id INTO v_subject_uuid;

  -- Sprawdź czy relacja jest singletonem
  SELECT is_singleton INTO v_is_singleton FROM public.relations WHERE name = NEW.relation;
  IF v_is_singleton IS NULL THEN
    v_is_singleton := NEW.relation IN (
      'pracuje_w', 'jest_zatrudniony_w', 'mieszka_w', 'studiuje_na', 'uczęszcza_do',
      'jest_w_związku_z', 'ma_wiek', 'pełni_rolę', 'jest_liderem_w', 'ma_aktywny_cel',
      'jest', 'ma_role', 'uczestniczy_w', 'studiuje', 'pracuje_nad'
    );
  END IF;

  -- Resolve/Insert relation
  INSERT INTO public.relations (name, is_singleton)
  VALUES (NEW.relation, v_is_singleton)
  ON CONFLICT (name) DO UPDATE SET
    is_singleton = EXCLUDED.is_singleton
  RETURNING id INTO v_relation_uuid;

  -- Resolve/Insert object entity
  INSERT INTO public.entities (user_id, canonical_name, kind)
  VALUES (NEW.user_id, NEW.target_entity, NEW.target_type)
  ON CONFLICT (user_id, canonical_name) DO UPDATE SET
    kind = EXCLUDED.kind
  RETURNING id INTO v_object_uuid;

  -- Determine claims status from new link info
  IF NEW.memory_type = 'hypothesis' THEN
    v_temp_status := 'hypothesis';
  ELSIF NEW.relation = 'deklaruje' THEN
    v_temp_status := 'declared';
  ELSE
    v_temp_status := 'current';
  END IF;

  -- Singleton deprecation on claims
  IF v_is_singleton THEN
    UPDATE public.claims
    SET
      status = 'deprecated',
      valid_to = NEW.observed_at,
      superseded_by = NEW.id,
      metadata = metadata || jsonb_build_object(
        'deprecated_reason', 'superseded by newer claim via sync',
        'deprecated_at', now()
      )
    WHERE user_id = NEW.user_id
      AND subject_id = v_subject_uuid
      AND relation_id = v_relation_uuid
      AND object_id != v_object_uuid
      AND status = 'active';
  END IF;

  -- Upsert claim matching the link id
  INSERT INTO public.claims (
    id, user_id, subject_id, relation_id, object_id,
    epistemic_status, derivation, source_observation_ids,
    weight, evidence_count, learned_at, valid_from, valid_to, status, metadata
  )
  VALUES (
    NEW.id, NEW.user_id, v_subject_uuid, v_relation_uuid, v_object_uuid,
    CASE 
      WHEN NEW.memory_type = 'hypothesis' THEN 'hypothesis'
      WHEN NEW.memory_type = 'preference' THEN 'preference'
      ELSE 'fact'
    END, 
    'llm', 
    CASE WHEN NEW.source_episode_id IS NOT NULL THEN ARRAY[NEW.source_episode_id] ELSE ARRAY[]::uuid[] END,
    NEW.weight, NEW.evidence_count, NEW.created_at, NEW.observed_at, NEW.valid_until, 
    NEW.status, coalesce(NEW.metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, subject_id, relation_id, object_id) DO UPDATE SET
    weight = EXCLUDED.weight,
    evidence_count = EXCLUDED.evidence_count,
    status = EXCLUDED.status,
    valid_to = EXCLUDED.valid_to,
    metadata = EXCLUDED.metadata;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.sync_vanguard_entity_links_to_claims() SET search_path = public, pg_temp;
