-- ============================================================
-- VANGUARD OS — FIX EPISTEMIC MISLABELING OF CORRELATIONS
-- ============================================================
-- correlations.ts writes memory_type='correlation' to vanguard_entity_links.
-- The sync trigger only special-cased 'hypothesis'/'preference' and fell through
-- to 'fact' for everything else — so a statistical correlation (r/p/N derived,
-- not a directly observed fact) was being stored in claims as epistemic_status='fact'
-- with derivation='llm', even though it's a deterministic computation, not an LLM claim.
-- Fix: correlations are hypotheses (inferred, not observed) with deterministic derivation.

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
  v_epistemic_status text;
  v_derivation text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.claims WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  v_epistemic_status := CASE
    WHEN NEW.memory_type = 'hypothesis' THEN 'hypothesis'
    WHEN NEW.memory_type = 'preference' THEN 'preference'
    WHEN NEW.memory_type = 'correlation' THEN 'hypothesis'
    ELSE 'fact'
  END;
  v_derivation := CASE
    WHEN NEW.memory_type = 'correlation' THEN 'deterministic'
    ELSE 'llm'
  END;

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
      v_epistemic_status,
      v_derivation,
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
      embedding = NEW.embedding,
      epistemic_status = v_epistemic_status,
      derivation = v_derivation
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
      embedding = NEW.embedding,
      epistemic_status = v_epistemic_status,
      derivation = v_derivation
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
        embedding = NEW.embedding,
        epistemic_status = v_epistemic_status,
        derivation = v_derivation
      WHERE id = NEW.id;
    ELSE
      INSERT INTO public.claims (
        id, user_id, subject_id, relation_id, object_id,
        epistemic_status, derivation, source_observation_ids,
        weight, evidence_count, learned_at, valid_from, valid_to, status, metadata, fact_text, embedding
      )
      VALUES (
        NEW.id, NEW.user_id, v_subject_uuid, v_relation_uuid, v_object_uuid,
        v_epistemic_status,
        v_derivation,
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

-- Backfill: reclassify existing correlation claims that were mislabeled as 'fact' before this fix.
-- The sync trigger uses NEW.id as claims.id directly, so the two tables share primary keys.
UPDATE public.claims c
SET epistemic_status = 'hypothesis', derivation = 'deterministic'
FROM public.vanguard_entity_links l
WHERE c.id = l.id
  AND l.memory_type = 'correlation'
  AND c.epistemic_status = 'fact';
