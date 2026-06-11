-- ============================================================================
-- MIGRATION: 20260611213502_p2_hygiene_advisories
-- Purpose (audit P2 follow-up, 2026-06-11):
--   1. Drop dead StayFree tables (StayFree = Dropped in FEATURE_LIFECYCLE.md).
--      phone_usage_daily is NOT dropped — it has an active local write path
--      (scripts/aw/aw-phone-import.cjs) and a reader (src/components/core/Stats.jsx).
--   2. Drop the unused `http` extension — every runtime HTTP call (cron jobs and
--      DB functions) uses pg_net's net.http_post; no function body or cron command
--      references the http extension.
--   3. Remove anon/authenticated EXECUTE on SECURITY DEFINER functions flagged by
--      Supabase security advisors. service_role keeps access (edge functions);
--      authenticated keeps access only to save_workout_atomic (WorkoutLogger.jsx).
--      trigger_vanguard_classification stays functional: trigger EXECUTE is
--      checked at trigger creation time, not at fire time.
--      vanguard-sunday-cleanup cron stays functional: it runs as the function
--      owner (postgres), whose privileges are implicit.
--   4. Scope progress-photos storage SELECT/DELETE policies to the file owner.
--      Display uses public object URLs (bucket stays public); the broad SELECT
--      policy only enabled listing the whole bucket, which the advisor flags.
--      Photos.jsx never calls storage.list(); remove() needs SELECT + DELETE,
--      both kept via the owner-scoped policies. All existing objects have owner set.
--
-- Deliberately NOT done (accepted risk, documented):
--   - Moving vector / pg_trgm / pg_net out of `public`: pg_net does not support
--     ALTER EXTENSION ... SET SCHEMA; moving vector/pg_trgm would break the
--     functions pinned to search_path = public, pg_temp in migration
--     20260611150000 (vector operators / similarity() would stop resolving).
--     Revisit only together with a coordinated search_path update.
--   - Auth leaked-password protection: dashboard-only toggle, no SQL surface.
-- ============================================================================

-- 1. Dead StayFree tables (0 code references repo-wide)
DROP TABLE IF EXISTS public.screen_time_logs CASCADE;
DROP TABLE IF EXISTS public.screen_time_details CASCADE;

-- 2. Unused http extension (no CASCADE: error out if anything unexpectedly depends)
DROP EXTENSION IF EXISTS http;

-- 3a. Edge-function-only RPCs — service_role only
REVOKE EXECUTE ON FUNCTION public.find_entity_seeds_by_embedding(vector, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_mentioned_entities(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_vanguard_graph_context(text[], integer, uuid, text, timestamp with time zone, boolean, double precision) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_vanguard_graph_context(text[], integer, uuid, text, boolean, timestamp with time zone, double precision) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_vanguard_entity_link(uuid, text, text, text, text, text, double precision, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_vanguard_entity_link(uuid, text, text, text, text, text, double precision, text, text, jsonb, uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_all_todoist_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_daily_snapshots(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_vanguard_classification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vanguard_graph_cleanup() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.find_entity_seeds_by_embedding(vector, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_mentioned_entities(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_vanguard_graph_context(text[], integer, uuid, text, timestamp with time zone, boolean, double precision) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_vanguard_graph_context(text[], integer, uuid, text, boolean, timestamp with time zone, double precision) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_vanguard_entity_link(uuid, text, text, text, text, text, double precision, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_vanguard_entity_link(uuid, text, text, text, text, text, double precision, text, text, jsonb, uuid, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_all_todoist_users() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_daily_snapshots(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_vanguard_classification() TO service_role;
GRANT EXECUTE ON FUNCTION public.vanguard_graph_cleanup() TO service_role;

-- 3b. Frontend RPC — authenticated + service_role, no anon
REVOKE EXECUTE ON FUNCTION public.save_workout_atomic(uuid, character varying, timestamp with time zone, timestamp with time zone, text, boolean, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_workout_atomic(uuid, character varying, timestamp with time zone, timestamp with time zone, text, boolean, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_workout_atomic(uuid, character varying, timestamp with time zone, timestamp with time zone, text, boolean, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_workout_atomic(uuid, character varying, timestamp with time zone, timestamp with time zone, text, boolean, jsonb, integer) TO authenticated, service_role;

-- 4. progress-photos: owner-scoped SELECT/DELETE (stops whole-bucket listing)
ALTER POLICY "Zalogowani mogą oglądać zdjęcia" ON storage.objects
  USING (bucket_id = 'progress-photos' AND owner = auth.uid());
ALTER POLICY "Zalogowani mogą usuwać zdjęcia" ON storage.objects
  USING (bucket_id = 'progress-photos' AND owner = auth.uid());
