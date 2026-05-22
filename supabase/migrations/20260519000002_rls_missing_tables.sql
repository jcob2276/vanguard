-- =============================================================
-- RLS audit: tabele bez Row Level Security
-- Znalezione: vanguard_feedback, vanguard_curiosity_queue,
--             vanguard_relation_ontology, vanguard_singleton_relations
-- =============================================================

-- ---- 1. vanguard_feedback ----
ALTER TABLE public.vanguard_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own feedback"
  ON public.vanguard_feedback FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Service role bypass feedback"
  ON public.vanguard_feedback FOR ALL TO service_role
  USING (true);

-- ---- 2. vanguard_curiosity_queue ----
ALTER TABLE public.vanguard_curiosity_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own curiosity queue"
  ON public.vanguard_curiosity_queue FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Service role bypass curiosity_queue"
  ON public.vanguard_curiosity_queue FOR ALL TO service_role
  USING (true);

-- ---- 3. vanguard_relation_ontology ----
-- Tabela referencyjna (brak user_id). RLS wymagane przez Supabase.
-- Każdy uwierzytelniony użytkownik może czytać, tylko service role może pisać.
ALTER TABLE public.vanguard_relation_ontology ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read relation ontology"
  ON public.vanguard_relation_ontology FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role bypass relation_ontology"
  ON public.vanguard_relation_ontology FOR ALL TO service_role
  USING (true);

-- ---- 4. vanguard_singleton_relations ----
-- Tabela referencyjna (brak user_id). Identyczny wzorzec.
ALTER TABLE public.vanguard_singleton_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read singleton relations"
  ON public.vanguard_singleton_relations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role bypass singleton_relations"
  ON public.vanguard_singleton_relations FOR ALL TO service_role
  USING (true);
