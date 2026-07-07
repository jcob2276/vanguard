-- Create view_events table for telemetry tracking of route/screen views.

CREATE TABLE IF NOT EXISTS public.view_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  view_name    text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.view_events ENABLE ROW LEVEL SECURITY;

-- Grant INSERT to authenticated, SELECT to service_role only
GRANT INSERT ON TABLE public.view_events TO authenticated;
GRANT ALL ON TABLE public.view_events TO service_role;

-- Allow users to insert their own view telemetry
CREATE POLICY "authenticated_insert" ON public.view_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
