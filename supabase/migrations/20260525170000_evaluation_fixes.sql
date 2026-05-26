-- MIGRACJA: Vanguard OS Evaluation Fixes
-- Data: 2026-05-25
-- Cel: Naprawa niespójności DDL, brakujących RPC, zdublowanych cronów oraz utworzenie widoku confirmed_friction_events.

-- =========================================================================
-- 1. Aktualizacja tabeli friction_events (mismatch typów i brakujące kolumny)
-- =========================================================================

-- Dodanie brakujących kolumn, jeśli nie istnieją (zgodność z auto-classify)
ALTER TABLE public.friction_events ADD COLUMN IF NOT EXISTS declared_intention text;
ALTER TABLE public.friction_events ADD COLUMN IF NOT EXISTS actual_behavior text;
ALTER TABLE public.friction_events ADD COLUMN IF NOT EXISTS deviation text;
ALTER TABLE public.friction_events ADD COLUMN IF NOT EXISTS immediate_cost text;
ALTER TABLE public.friction_events ADD COLUMN IF NOT EXISTS emotional_state text;
ALTER TABLE public.friction_events ADD COLUMN IF NOT EXISTS people_involved text[];
ALTER TABLE public.friction_events ADD COLUMN IF NOT EXISTS location_context text;

-- Usunięcie starego constrainta friction_type i nałożenie poprawionego
ALTER TABLE public.friction_events DROP CONSTRAINT IF EXISTS friction_events_friction_type_check;
ALTER TABLE public.friction_events ADD CONSTRAINT friction_events_friction_type_check 
  CHECK (friction_type IN (
    'avoidance', 'procrastination', 'emotional_spike', 'habit_break', 
    'social_withdrawal', 'sleep_disruption', 'training_drop', 
    'social_hesitation', 'communication_drift', 'self_control_break', 
    'positive_micro_action', 'other'
  ));

-- Dodanie kolumny status, jeśli nie istnieje (potrzebna do confirmed gate)
ALTER TABLE public.friction_events ADD COLUMN IF NOT EXISTS status text DEFAULT 'raw' 
  CHECK (status IN ('raw', 'good', 'user_confirmed', 'user_corrected'));

-- =========================================================================
-- 2. Usunięcie zdublowanego cron joba dla Analyst
-- =========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('vanguard-daily-shadow-analysis');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available or unschedule failed';
END;
$$;

-- =========================================================================
-- 3. Zaimplementowanie brakującego RPC find_entity_seeds_by_embedding
-- =========================================================================
CREATE OR REPLACE FUNCTION public.find_entity_seeds_by_embedding(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_count     int DEFAULT 6
) RETURNS TABLE (
  entity_name     text,
  best_similarity float
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH entity_similarities AS (
    SELECT
      el.source_entity AS entity,
      1 - (el.embedding <=> query_embedding) AS similarity
    FROM public.vanguard_entity_links el
    WHERE el.user_id = match_user_id
      AND el.embedding IS NOT NULL
      AND el.status = 'active'
      AND (el.valid_until IS NULL OR el.valid_until > now())
    
    UNION ALL
    
    SELECT
      el.target_entity AS entity,
      1 - (el.embedding <=> query_embedding) AS similarity
    FROM public.vanguard_entity_links el
    WHERE el.user_id = match_user_id
      AND el.embedding IS NOT NULL
      AND el.status = 'active'
      AND (el.valid_until IS NULL OR el.valid_until > now())
  )
  SELECT
    entity AS entity_name,
    MAX(similarity)::float AS best_similarity
  FROM entity_similarities
  GROUP BY entity
  ORDER BY best_similarity DESC
  LIMIT match_count;
END;
$$;

-- =========================================================================
-- 4. Utworzenie widoku confirmed_friction_events (bramka epistemiczna)
-- =========================================================================
CREATE OR REPLACE VIEW public.confirmed_friction_events AS
  SELECT *
  FROM public.friction_events
  WHERE status IN ('good', 'user_confirmed', 'user_corrected');
