-- ============================================================
-- VANGUARD OS — DAY 2: ENTITIES, RELATIONS & CLAIMS
-- Normalized 4-layer Graph Architecture & Dual-Write Trigger
-- ============================================================

-- 1. Table public.entities
CREATE TABLE IF NOT EXISTS public.entities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    kind text NOT NULL,
    canonical_name text NOT NULL,
    merged_into uuid REFERENCES public.entities(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_canonical_name UNIQUE (user_id, canonical_name)
);

-- 2. Table public.entity_aliases
CREATE TABLE IF NOT EXISTS public.entity_aliases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    alias text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_entity_alias UNIQUE (entity_id, alias)
);

-- 3. Table public.relations
CREATE TABLE IF NOT EXISTS public.relations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    is_singleton boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Table public.claims
CREATE TABLE IF NOT EXISTS public.claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subject_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    relation_id uuid REFERENCES public.relations(id) ON DELETE CASCADE NOT NULL,
    object_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    epistemic_status text DEFAULT 'fact' NOT NULL CHECK (epistemic_status IN ('fact', 'hypothesis', 'preference', 'prediction')),
    derivation text DEFAULT 'llm' NOT NULL CHECK (derivation IN ('human', 'deterministic', 'llm')),
    source_observation_ids uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
    weight double precision DEFAULT 1.0,
    evidence_count integer DEFAULT 1,
    learned_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    valid_from timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    valid_to timestamp with time zone,
    status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'deprecated', 'historical', 'disputed')),
    superseded_by uuid REFERENCES public.claims(id) ON UPDATE CASCADE ON DELETE SET NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT unique_claim_triple UNIQUE (user_id, subject_id, relation_id, object_id)
);

-- 5. Seed relations with singletons
INSERT INTO public.relations (name, is_singleton) VALUES
  ('pracuje_w',           true),
  ('jest_zatrudniony_w',  true),
  ('mieszka_w',           true),
  ('studiuje_na',         true),
  ('uczęszcza_do',        true),
  ('jest_w_związku_z',    true),
  ('ma_wiek',             true),
  ('pełni_rolę',          true),
  ('jest_liderem_w',      true),
  ('ma_aktywny_cel',      true),
  ('jest',                true),
  ('ma_role',             true),
  ('uczestniczy_w',       true),
  ('studiuje',            true),
  ('pracuje_nad',         true)
ON CONFLICT (name) DO UPDATE SET
  is_singleton = EXCLUDED.is_singleton;

-- 6. Enable RLS on new tables
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- public.entities
CREATE POLICY users_own_entities ON public.entities
    FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY service_role_entities ON public.entities
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- public.entity_aliases
CREATE POLICY users_own_entity_aliases ON public.entity_aliases
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.entities e WHERE e.id = entity_id AND e.user_id = auth.uid())
    );
CREATE POLICY service_role_entity_aliases ON public.entity_aliases
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- public.relations
CREATE POLICY authenticated_select_relations ON public.relations
    FOR SELECT TO authenticated USING (true);
CREATE POLICY service_role_relations ON public.relations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- public.claims
CREATE POLICY users_own_claims ON public.claims
    FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY service_role_claims ON public.claims
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. Grant permissions
GRANT ALL ON TABLE public.entities TO service_role;
GRANT SELECT ON TABLE public.entities TO authenticated;

GRANT ALL ON TABLE public.entity_aliases TO service_role;
GRANT SELECT ON TABLE public.entity_aliases TO authenticated;

GRANT ALL ON TABLE public.relations TO service_role;
GRANT SELECT ON TABLE public.relations TO authenticated;

GRANT ALL ON TABLE public.claims TO service_role;
GRANT SELECT ON TABLE public.claims TO authenticated;

-- 9. Trigger Function for Dual-Write Sync
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Register Trigger
CREATE OR REPLACE TRIGGER tr_sync_entity_links_to_claims
AFTER INSERT OR UPDATE OR DELETE ON public.vanguard_entity_links
FOR EACH ROW
EXECUTE FUNCTION public.sync_vanguard_entity_links_to_claims();

-- 11. Run backfill to sync all existing links to the new claims table
UPDATE public.vanguard_entity_links SET weight = weight;
