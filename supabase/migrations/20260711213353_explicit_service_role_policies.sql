-- ============================================================
-- P1.4 — Explicit "service role bypass" policies for RLS-enabled-no-policy
-- tables. Pure documentation of existing behavior, zero change: RLS with zero
-- policies already denies anon/authenticated entirely by default (service_role
-- bypasses RLS at the Postgres role level regardless of policies). Adding an
-- explicit policy just removes advisor noise and makes intent unambiguous —
-- mirrors the existing "Service role bypass world state" pattern on
-- vanguard_world_state.
-- ============================================================

CREATE POLICY "Service role bypass" ON public.vanguard_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass" ON public.vanguard_knowledge
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass" ON public.pattern_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
