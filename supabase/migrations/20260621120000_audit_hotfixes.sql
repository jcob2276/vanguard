-- Hotfix for critical security and performance issues found in Vanguard audit.

-- 1. Revoke public execute access from sensitive RPC functions.
REVOKE EXECUTE ON FUNCTION public.replace_daily_food_entries FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.replace_daily_food_entries FROM anon;
REVOKE EXECUTE ON FUNCTION public.replace_calendar_window FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.replace_calendar_window FROM anon;

-- 2. Add security_invoker = true to confirmed_friction_events view.
CREATE OR REPLACE VIEW public.confirmed_friction_events WITH (security_invoker = true) AS
  SELECT * FROM public.friction_events
  WHERE review_status IN ('good', 'user_confirmed', 'user_corrected')
    AND (event_kind IS NULL OR event_kind IN ('friction_event', 'positive_micro_action'));

-- 3. Add missing indexes on vanguard_notes and vanguard_links for performance.
CREATE INDEX IF NOT EXISTS idx_vanguard_notes_user_id ON public.vanguard_notes (user_id);
CREATE INDEX IF NOT EXISTS idx_vanguard_notes_is_pinned ON public.vanguard_notes (is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_vanguard_notes_created_at ON public.vanguard_notes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vanguard_links_user_id ON public.vanguard_links (user_id);
CREATE INDEX IF NOT EXISTS idx_vanguard_links_status ON public.vanguard_links (status);
CREATE INDEX IF NOT EXISTS idx_vanguard_links_created_at ON public.vanguard_links (created_at DESC);
