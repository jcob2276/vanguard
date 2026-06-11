-- Tighten audit_events access.
--
-- audit_events is written by Edge Functions through the service role helper
-- only. The previous policy was FOR ALL TO public USING true / WITH CHECK true,
-- which made the table effectively public to anon/authenticated roles whenever
-- table grants existed.

REVOKE ALL ON TABLE public.audit_events FROM anon, authenticated;

DROP POLICY IF EXISTS service_role_full ON public.audit_events;

CREATE POLICY service_role_full
  ON public.audit_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
