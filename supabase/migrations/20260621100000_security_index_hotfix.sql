-- Hotfix: restore security_invoker on views recreated after the advisory patch,
-- add missing created_at index on vanguard_stream.

-- C2: strava_activities_clean was DROP+CREATE'd in 20260612000003 (after the
-- security_invoker patch in 20260611150000), resetting it to security_definer.
ALTER VIEW public.strava_activities_clean SET (security_invoker = true);

-- C3: strain_correlations was created in 20260612000002 and never received
-- security_invoker; it joins daily_strain, oura, nutrition — all RLS-protected.
ALTER VIEW public.strain_correlations SET (security_invoker = true);

-- H4: vanguard_stream is queried by (user_id, created_at) in every behavioral
-- function but had no compound index on that pair.
CREATE INDEX IF NOT EXISTS idx_vanguard_stream_user_created_at
  ON public.vanguard_stream (user_id, created_at DESC);
