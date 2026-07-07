-- Grant SELECT privileges to authenticated role on audit_events
GRANT SELECT ON TABLE public.audit_events TO authenticated;

-- Drop existing policies if any
DROP POLICY IF EXISTS authenticated_select_own ON public.audit_events;

-- Create policy allowing authenticated users to SELECT only their own audit logs
CREATE POLICY authenticated_select_own ON public.audit_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
