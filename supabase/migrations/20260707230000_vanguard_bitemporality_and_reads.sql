-- ============================================================
-- VANGUARD OS — DAY 3: BI-TEMPORALITY & READ RPCS
-- ============================================================

-- 1. Drop old constraint and add bi-temporal UNIQUE constraint
ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS unique_claim_triple;

ALTER TABLE public.claims ADD CONSTRAINT unique_claim_triple_learned UNIQUE (user_id, subject_id, relation_id, object_id, learned_at);

-- 2. Add fact_text and embedding columns to claims
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS fact_text text;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Create GIN index for full-text search on claims
CREATE INDEX IF NOT EXISTS claims_fact_text_fts_idx ON public.claims USING gin (to_tsvector('polish', fact_text));

-- 4. Deploy updated sync function
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

  -- Bi-temporal state transitions
  IF TG_OP = 'UPDATE' AND OLD.status = 'deprecated' AND NEW.status = 'active' THEN
    -- Reactivation! Insert a brand new claim, leaving the old one as historical
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.sync_vanguard_entity_links_to_claims() SET search_path = public, pg_temp;

-- 5. Deploy updated read RPCs
DROP FUNCTION IF EXISTS public.search_entity_links(vector, uuid, integer);
DROP FUNCTION IF EXISTS public.search_entity_links_fulltext(text, uuid, integer);

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
    s.canonical_name AS source_entity,
    r.name AS relation,
    o.canonical_name AS target_entity,
    s.kind AS source_type,
    o.kind AS target_type,
    c.evidence_count,
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM public.claims c
  JOIN public.entities s ON c.subject_id = s.id
  JOIN public.relations r ON c.relation_id = r.id
  JOIN public.entities o ON c.object_id = o.id
  WHERE c.user_id = match_user_id
    AND c.embedding IS NOT NULL
    AND c.status = 'active'
    AND (c.valid_to IS NULL OR c.valid_to > now())
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

ALTER FUNCTION public.search_entity_links(vector, uuid, integer) SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.search_entity_links_fulltext(
  query_text     text,
  match_user_id  uuid,
  match_count    int DEFAULT 20
) RETURNS TABLE (
  evidence_count int,
  fact_text      text,
  rank           float,
  relation       text,
  source_entity  text,
  source_type    text,
  target_entity  text,
  target_type    text
) LANGUAGE sql STABLE AS $$
  SELECT
    c.evidence_count,
    c.fact_text,
    ts_rank_cd(to_tsvector('polish', c.fact_text), plainto_tsquery('polish', query_text))::float AS rank,
    r.name AS relation,
    s.canonical_name AS source_entity,
    s.kind AS source_type,
    o.canonical_name AS target_entity,
    o.kind AS target_type
  FROM public.claims c
  JOIN public.entities s ON c.subject_id = s.id
  JOIN public.relations r ON c.relation_id = r.id
  JOIN public.entities o ON c.object_id = o.id
  WHERE c.user_id = match_user_id
    AND c.fact_text IS NOT NULL
    AND c.status = 'active'
    AND (c.valid_to IS NULL OR c.valid_to > now())
    AND to_tsvector('polish', c.fact_text) @@ plainto_tsquery('polish', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$;

ALTER FUNCTION public.search_entity_links_fulltext(text, uuid, integer) SET search_path = public, pg_temp;

-- 6. Trigger backfill to copy fact_text and embedding to claims
UPDATE public.vanguard_entity_links SET weight = weight;
