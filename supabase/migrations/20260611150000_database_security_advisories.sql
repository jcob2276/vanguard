-- ============================================================================
-- MIGRATION: 20260611150000_database_security_advisories
-- Purpose: 
--   1. Set (security_invoker = true) on views to prevent RLS bypass.
--   2. Alter security-sensitive functions to set search_path = public, pg_temp.
-- ============================================================================

-- 1. Set security_invoker = true on views
ALTER VIEW public.v_friction_debug SET (security_invoker = true);
ALTER VIEW public.v_graph_temporal_guard SET (security_invoker = true);
ALTER VIEW public.v_friction_pipeline_status SET (security_invoker = true);
ALTER VIEW public.v_friction_review SET (security_invoker = true);
ALTER VIEW public.v_friction_daily_qa SET (security_invoker = true);
ALTER VIEW public.confirmed_friction_events SET (security_invoker = true);
ALTER VIEW public.strava_activities_clean SET (security_invoker = true);

-- 2. Alter security-sensitive functions to set secure search_path
ALTER FUNCTION public.get_brain_health_report(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.search_entity_links_fulltext(text, uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.deprecate_superseded_facts(uuid, text, text, text, double precision, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_vanguard_classification() SET search_path = public, pg_temp;
ALTER FUNCTION public.find_entity_seeds_by_embedding(vector, uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.compute_lag_correlations(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.match_vanguard_content(vector, double precision, integer, uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.match_vanguard_content(vector, double precision, integer, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.clean_old_vanguard_logs() SET search_path = public, pg_temp;
ALTER FUNCTION public.search_entity_links(vector, uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_all_todoist_users() SET search_path = public, pg_temp;
ALTER FUNCTION public.normalize_relation(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_vanguard_relation_ontology() SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_vanguard_knowledge() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_daily_snapshots(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.vanguard_graph_cleanup() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_vanguard_graph_context(text[], integer, uuid, text, timestamp with time zone, boolean, double precision) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_vanguard_graph_context(text[], integer, uuid, text, boolean, timestamp with time zone, double precision) SET search_path = public, pg_temp;
ALTER FUNCTION public.upsert_vanguard_entity_link(uuid, text, text, text, text, text, double precision, text, text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.upsert_vanguard_entity_link(uuid, text, text, text, text, text, double precision, text, text, jsonb, uuid, timestamp with time zone) SET search_path = public, pg_temp;
