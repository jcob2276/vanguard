-- MIGRACJA: RELATIONAL GRAPH FOUNDATION (v7.1)
-- Implementacja tabeli linków encji dla GraphRAG bez AGE.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.vanguard_entity_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  source_entity text NOT NULL,   -- "Technika: Odwrócenie ramy"
  source_type text NOT NULL,     -- "technique" | "person" | "state" | "event" | "physical_state"
  relation text NOT NULL,        -- "CAUSES" | "RAISED_STRESS" | "PRECEDES" | "CORRELATES_WITH"
  target_entity text NOT NULL,
  target_type text NOT NULL,
  weight float DEFAULT 1.0,      -- rośnie przy powtórzeniach
  first_seen date DEFAULT CURRENT_DATE,
  last_seen date DEFAULT CURRENT_DATE,
  evidence_count integer DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_entity_link UNIQUE (user_id, source_entity, relation, target_entity)
);

-- RLS
ALTER TABLE public.vanguard_entity_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policy
        WHERE polname = 'Users own their links'
    ) THEN
        CREATE POLICY "Users own their links"
        ON public.vanguard_entity_links FOR ALL USING (auth.uid() = user_id);
    END IF;
END
$$;

-- Indeksy dla szybkich skoków (traversal)
CREATE INDEX IF NOT EXISTS idx_entity_links_user_source ON public.vanguard_entity_links(user_id, source_entity);
CREATE INDEX IF NOT EXISTS idx_entity_links_user_target ON public.vanguard_entity_links(user_id, target_entity);

-- Indeksy GIN dla pg_trgm (Bug 1: Szybkie podobieństwo)
CREATE INDEX IF NOT EXISTS idx_entity_links_source_trgm ON public.vanguard_entity_links USING gin(source_entity gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_entity_links_target_trgm ON public.vanguard_entity_links USING gin(target_entity gin_trgm_ops);

-- Funkcja do trawersowania grafu (Recursive CTE)
-- Szuka powiązań do N skoków od zadanych encji
CREATE OR REPLACE FUNCTION public.get_vanguard_graph_context(
  start_entities text[],
  max_depth integer DEFAULT 2,
  user_id_param uuid DEFAULT NULL
)
RETURNS TABLE (
  source_entity text,
  relation text,
  target_entity text,
  depth integer,
  path text[]
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE graph_path AS (
    -- Anchor: bezpośrednie relacje od encji startowych
    SELECT 
      l.source_entity, 
      l.relation, 
      l.target_entity, 
      1 as depth,
      ARRAY[l.source_entity, l.target_entity] as path
    FROM public.vanguard_entity_links l
    WHERE l.user_id = user_id_param 
      AND (l.source_entity = ANY(start_entities) OR l.target_entity = ANY(start_entities))
      AND l.evidence_count >= 2  -- Filtr szumu: ignorujemy pojedyncze obserwacje

    UNION ALL

    -- Recursive step: kolejne skoki
    SELECT 
      l.source_entity, 
      l.relation, 
      l.target_entity, 
      gp.depth + 1,
      gp.path || l.target_entity
    FROM public.vanguard_entity_links l
    JOIN graph_path gp ON (l.source_entity = gp.target_entity OR l.target_entity = gp.source_entity)
    WHERE l.user_id = user_id_param 
      AND gp.depth < max_depth
      AND l.evidence_count >= 2  -- Filtr szumu na każdym skoku
      AND NOT (l.target_entity = ANY(gp.path)) -- zapobieganie cyklom
  )
  SELECT DISTINCT ON (gp.source_entity, gp.relation, gp.target_entity)
    gp.source_entity, gp.relation, gp.target_entity, gp.depth, gp.path
  FROM graph_path gp
  ORDER BY gp.source_entity, gp.relation, gp.target_entity, gp.depth ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Znajdź encje wspomniane w tekście
CREATE OR REPLACE FUNCTION public.find_mentioned_entities(
  query_text text,
  user_id_param uuid
)
RETURNS TABLE (entity_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT e.name
  FROM (
    SELECT source_entity as name FROM public.vanguard_entity_links WHERE user_id = user_id_param
    UNION
    SELECT target_entity as name FROM public.vanguard_entity_links WHERE user_id = user_id_param
  ) e
  WHERE query_text ILIKE '%' || e.name || '%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic Upsert dla triad
CREATE OR REPLACE FUNCTION public.upsert_vanguard_entity_link(
  p_user_id uuid,
  p_source text,
  p_source_type text,
  p_relation text,
  p_target text,
  p_target_type text
)
RETURNS void AS $$
DECLARE
  v_source text := p_source;
  v_target text := p_target;
BEGIN
  -- Real-time Entity Resolution: Szukaj podobnego źródła
  SELECT name INTO v_source FROM (
    SELECT source_entity as name FROM public.vanguard_entity_links WHERE user_id = p_user_id
    UNION
    SELECT target_entity as name FROM public.vanguard_entity_links WHERE user_id = p_user_id
  ) e 
  WHERE similarity(e.name, p_source) > 0.85 
  ORDER BY similarity(e.name, p_source) DESC 
  LIMIT 1;
  
  IF v_source IS NULL THEN v_source := p_source; END IF;

  -- Szukaj podobnego celu
  SELECT name INTO v_target FROM (
    SELECT source_entity as name FROM public.vanguard_entity_links WHERE user_id = p_user_id
    UNION
    SELECT target_entity as name FROM public.vanguard_entity_links WHERE user_id = p_user_id
  ) e 
  WHERE similarity(e.name, p_target) > 0.85 
  ORDER BY similarity(e.name, p_target) DESC 
  LIMIT 1;

  IF v_target IS NULL THEN v_target := p_target; END IF;

  INSERT INTO public.vanguard_entity_links (
    user_id, source_entity, source_type, relation, target_entity, target_type, weight, evidence_count, first_seen, last_seen
  )
  VALUES (
    p_user_id, v_source, p_source_type, p_relation, v_target, p_target_type, 1.0, 1, CURRENT_DATE, CURRENT_DATE
  )
  ON CONFLICT (user_id, source_entity, relation, target_entity)
  DO UPDATE SET
    evidence_count = vanguard_entity_links.evidence_count + 1,
    weight = LEAST(5.0, vanguard_entity_links.weight + 0.2),
    last_seen = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NIEDZIELNY CLEANUP: Scalanie synonimów (Entity Resolution v2)
-- Wywoływane co niedzielę o 5:00
CREATE OR REPLACE FUNCTION public.vanguard_graph_cleanup()
RETURNS void AS $$
DECLARE
    r RECORD;
    r_source RECORD;
    r_target RECORD;
BEGIN
    -- 1. Znajdź pary encji o podobieństwie > 0.85, które nie są identyczne
    -- Wybieramy "winnera" (dłuższa nazwa lub większy evidence_count)
    FOR r IN (
        SELECT DISTINCT ON (least(e1.name, e2.name), greatest(e1.name, e2.name))
            e1.name as loser,
            e2.name as winner,
            e1.user_id
        FROM (
            SELECT DISTINCT source_entity as name, user_id FROM public.vanguard_entity_links
            UNION
            SELECT DISTINCT target_entity as name, user_id FROM public.vanguard_entity_links
        ) e1
        JOIN (
            SELECT DISTINCT source_entity as name, user_id FROM public.vanguard_entity_links
            UNION
            SELECT DISTINCT target_entity as name, user_id FROM public.vanguard_entity_links
        ) e2 ON e1.user_id = e2.user_id AND e1.name < e2.name
        WHERE similarity(e1.name, e2.name) > 0.85
        ORDER BY least(e1.name, e2.name), greatest(e1.name, e2.name), 
                 (CASE WHEN length(e2.name) >= length(e1.name) THEN 1 ELSE 0 END) DESC
    ) LOOP
        -- 2. Naprawa Bug 2: Używamy atomowego upsertu dla zwycięzcy, 
        -- przekazując mu evidence_count przegranego, a potem usuwamy przegranego.
        
        -- Dla każdego wiersza "losera" jako source
        FOR r_source IN (SELECT * FROM public.vanguard_entity_links WHERE user_id = r.user_id AND source_entity = r.loser) LOOP
            INSERT INTO public.vanguard_entity_links (
                user_id, source_entity, source_type, relation, target_entity, target_type, weight, evidence_count, first_seen, last_seen
            )
            VALUES (
                r.user_id, r.winner, r_source.source_type, r_source.relation, r_source.target_entity, r_source.target_type, r_source.weight, r_source.evidence_count, r_source.first_seen, r_source.last_seen
            )
            ON CONFLICT (user_id, source_entity, relation, target_entity)
            DO UPDATE SET
                evidence_count = vanguard_entity_links.evidence_count + EXCLUDED.evidence_count,
                weight = GREATEST(vanguard_entity_links.weight, EXCLUDED.weight),
                last_seen = GREATEST(vanguard_entity_links.last_seen, EXCLUDED.last_seen);
        END LOOP;

        -- Dla każdego wiersza "losera" jako target
        FOR r_target IN (SELECT * FROM public.vanguard_entity_links WHERE user_id = r.user_id AND target_entity = r.loser) LOOP
            INSERT INTO public.vanguard_entity_links (
                user_id, source_entity, source_type, relation, target_entity, target_type, weight, evidence_count, first_seen, last_seen
            )
            VALUES (
                r.user_id, r_target.source_entity, r_target.source_type, r_target.relation, r.winner, r_target.target_type, r_target.weight, r_target.evidence_count, r_target.first_seen, r_target.last_seen
            )
            ON CONFLICT (user_id, source_entity, relation, target_entity)
            DO UPDATE SET
                evidence_count = vanguard_entity_links.evidence_count + EXCLUDED.evidence_count,
                weight = GREATEST(vanguard_entity_links.weight, EXCLUDED.weight),
                last_seen = GREATEST(vanguard_entity_links.last_seen, EXCLUDED.last_seen);
        END LOOP;

        -- Usuń wszystkie ślady "losera"
        DELETE FROM public.vanguard_entity_links WHERE user_id = r.user_id AND (source_entity = r.loser OR target_entity = r.loser);
        
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Komentarz: Aby odpalić w pg_cron (Supabase Dashboard -> SQL Editor):
-- SELECT cron.schedule('vanguard-sunday-cleanup', '0 5 * * 0', 'SELECT public.vanguard_graph_cleanup()');
