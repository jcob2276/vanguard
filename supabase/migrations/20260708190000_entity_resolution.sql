-- ============================================================
-- VANGUARD OS — ENTITY RESOLUTION LOGIC
-- ============================================================

-- 1. Helper function to resolve entity name via aliases/canonical and follow merges
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
  
  -- A. Check entity_aliases first (case-insensitive)
  SELECT ea.entity_id INTO v_entity_uuid
  FROM public.entity_aliases ea
  JOIN public.entities e ON ea.entity_id = e.id
  WHERE e.user_id = p_user_id AND lower(ea.alias) = lower(v_clean_name)
  LIMIT 1;

  -- B. Check entities canonical_name (case-insensitive)
  IF v_entity_uuid IS NULL THEN
    SELECT id INTO v_entity_uuid
    FROM public.entities
    WHERE user_id = p_user_id AND lower(canonical_name) = lower(v_clean_name)
    LIMIT 1;
  END IF;

  -- C. If not found, create new entity
  IF v_entity_uuid IS NULL THEN
    INSERT INTO public.entities (user_id, canonical_name, kind)
    VALUES (p_user_id, v_clean_name, p_kind)
    RETURNING id INTO v_entity_uuid;
  END IF;

  -- D. Follow merged_into reference recursively if the entity was merged
  WHILE EXISTS (SELECT 1 FROM public.entities WHERE id = v_entity_uuid AND merged_into IS NOT NULL) LOOP
    SELECT merged_into INTO v_entity_uuid
    FROM public.entities
    WHERE id = v_entity_uuid;
  END LOOP;

  RETURN v_entity_uuid;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.resolve_entity(uuid, text, text) SET search_path = public, pg_temp;

-- 2. Trigger to automatically populate entity_aliases when a new entity is inserted
CREATE OR REPLACE FUNCTION public.handle_new_entity_alias()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.entity_aliases (entity_id, alias)
  VALUES (NEW.id, NEW.canonical_name)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.handle_new_entity_alias() SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_new_entity_alias ON public.entities;
CREATE TRIGGER tr_new_entity_alias
  AFTER INSERT ON public.entities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_entity_alias();

-- 3. Update sync_vanguard_entity_links_to_claims() to use resolve_entity()
CREATE OR REPLACE FUNCTION public.sync_vanguard_entity_links_to_claims()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_uuid uuid;
  v_relation_uuid uuid;
  v_object_uuid uuid;
  v_is_singleton boolean;
  v_temp_status text;
  v_claim_id uuid;
  v_learned_at timestamp with time zone;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.claims WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  -- Resolve subject entity via entity resolution helper
  v_subject_uuid := public.resolve_entity(NEW.user_id, NEW.source_entity, NEW.source_type);

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

  -- Resolve object entity via entity resolution helper
  v_object_uuid := public.resolve_entity(NEW.user_id, NEW.target_entity, NEW.target_type);

  -- Check if we have an active claim for this triple
  SELECT id, learned_at INTO v_claim_id, v_learned_at
  FROM public.claims
  WHERE user_id = NEW.user_id
    AND subject_id = v_subject_uuid
    AND relation_id = v_relation_uuid
    AND object_id = v_object_uuid
    AND status = 'active'
  ORDER BY learned_at DESC
  LIMIT 1;

  -- Bi-temporal state transitions
  IF TG_OP = 'UPDATE' AND OLD.status = 'deprecated' AND NEW.status = 'active' THEN
    -- Reactivation! To preserve history, rename the old deprecated claim's ID
    UPDATE public.claims SET id = gen_random_uuid() WHERE id = NEW.id;
    -- Now NEW.id is free, so we can insert the new active claim!
    INSERT INTO public.claims (
      id, user_id, subject_id, relation_id, object_id,
      epistemic_status, derivation, source_observation_ids,
      weight, evidence_count, learned_at, valid_from, valid_to, status, metadata, fact_text, embedding
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
      NEW.weight, NEW.evidence_count, now(), NEW.observed_at, NEW.valid_until, 
      NEW.status, coalesce(NEW.metadata, '{}'::jsonb), NEW.fact_text, NEW.embedding
    );
  ELSIF EXISTS (SELECT 1 FROM public.claims WHERE id = NEW.id) THEN
    -- The claim already exists (active or deprecated), so just update it!
    UPDATE public.claims
    SET
      weight = NEW.weight,
      evidence_count = NEW.evidence_count,
      status = NEW.status,
      valid_to = NEW.valid_until,
      metadata = coalesce(NEW.metadata, '{}'::jsonb),
      fact_text = NEW.fact_text,
      embedding = NEW.embedding
    WHERE id = NEW.id;
  ELSIF v_claim_id IS NOT NULL THEN
    -- Update the existing active claim (preserves history by keeping learned_at and valid_from)
    UPDATE public.claims
    SET
      weight = NEW.weight,
      evidence_count = NEW.evidence_count,
      status = NEW.status,
      valid_to = NEW.valid_until,
      metadata = coalesce(NEW.metadata, '{}'::jsonb),
      fact_text = NEW.fact_text,
      embedding = NEW.embedding
    WHERE id = v_claim_id;
  ELSE
    -- No active claim exists, let's insert one or update the latest deprecated one matching ID
    IF NEW.status = 'deprecated' THEN
      UPDATE public.claims
      SET
        weight = NEW.weight,
        evidence_count = NEW.evidence_count,
        status = NEW.status,
        valid_to = NEW.valid_until,
        metadata = coalesce(NEW.metadata, '{}'::jsonb),
        fact_text = NEW.fact_text,
        embedding = NEW.embedding
      WHERE id = NEW.id;
    ELSE
      INSERT INTO public.claims (
        id, user_id, subject_id, relation_id, object_id,
        epistemic_status, derivation, source_observation_ids,
        weight, evidence_count, learned_at, valid_from, valid_to, status, metadata, fact_text, embedding
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
        NEW.status, coalesce(NEW.metadata, '{}'::jsonb), NEW.fact_text, NEW.embedding
      );
    END IF;
  END IF;

  -- Singleton deprecation on claims
  IF v_is_singleton AND NEW.status = 'active' THEN
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.sync_vanguard_entity_links_to_claims() SET search_path = public, pg_temp;
