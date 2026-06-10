CREATE TABLE IF NOT EXISTS public.audit_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  event_type   text NOT NULL,
  severity     text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','error','critical')),
  message      text,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  related_table text,
  related_id   text,
  metadata     jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full" ON public.audit_events
  USING (true)
  WITH CHECK (true);

CREATE INDEX audit_events_created_at_idx ON public.audit_events (created_at DESC);
CREATE INDEX audit_events_event_type_idx ON public.audit_events (event_type);
CREATE INDEX audit_events_severity_idx   ON public.audit_events (severity) WHERE severity IN ('error','critical');
