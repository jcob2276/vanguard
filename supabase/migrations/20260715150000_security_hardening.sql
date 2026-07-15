-- ============================================================================
-- Security hardening migration (2026-07-15, corrected against live schema)
--
-- Fixes from audit:
-- 1. get_data_coverage: missing auth.uid() guard — any user can query any other
-- 2. All application functions: pin SET search_path = '' to prevent
--    search_path injection. Excludes pgvector/pg_trgm extension-owned
--    functions (those are third-party code, not ours to alter).
-- ============================================================================

-- ── 1. Add auth.uid() guard to get_data_coverage ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_data_coverage(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today date;
  v_oura_30 float;
  v_oura_90 float;
  v_nutr_30 float;
  v_nutr_90 float;
  v_wins_30 float;
  v_wins_90 float;
  v_result jsonb;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_today := (now() AT TIME ZONE 'Europe/Warsaw')::date;

  SELECT COALESCE(count(*)::float / 30.0, 0.0) INTO v_oura_30
  FROM public.oura_daily_summary
  WHERE user_id = p_user_id AND date >= (v_today - 30) AND date < v_today;

  SELECT COALESCE(count(*)::float / 90.0, 0.0) INTO v_oura_90
  FROM public.oura_daily_summary
  WHERE user_id = p_user_id AND date >= (v_today - 90) AND date < v_today;

  SELECT COALESCE(count(*)::float / 30.0, 0.0) INTO v_nutr_30
  FROM public.daily_nutrition
  WHERE user_id = p_user_id AND date >= (v_today - 30) AND date < v_today AND calories > 0;

  SELECT COALESCE(count(*)::float / 90.0, 0.0) INTO v_nutr_90
  FROM public.daily_nutrition
  WHERE user_id = p_user_id AND date >= (v_today - 90) AND date < v_today AND calories > 0;

  WITH wins_recons_30 AS (
    SELECT DISTINCT date FROM public.daily_wins WHERE user_id = p_user_id AND date >= (v_today - 30) AND date < v_today
    UNION
    SELECT DISTINCT date FROM public.daily_reconciliations WHERE user_id = p_user_id AND date >= (v_today - 30) AND date < v_today
  )
  SELECT COALESCE(count(*)::float / 30.0, 0.0) INTO v_wins_30 FROM wins_recons_30;

  WITH wins_recons_90 AS (
    SELECT DISTINCT date FROM public.daily_wins WHERE user_id = p_user_id AND date >= (v_today - 90) AND date < v_today
    UNION
    SELECT DISTINCT date FROM public.daily_reconciliations WHERE user_id = p_user_id AND date >= (v_today - 90) AND date < v_today
  )
  SELECT COALESCE(count(*)::float / 90.0, 0.0) INTO v_wins_90 FROM wins_recons_90;

  v_result := jsonb_build_object(
    'oura_30', round(v_oura_30::numeric, 2),
    'oura_90', round(v_oura_90::numeric, 2),
    'nutrition_30', round(v_nutr_30::numeric, 2),
    'nutrition_90', round(v_nutr_90::numeric, 2),
    'wins_30', round(v_wins_30::numeric, 2),
    'wins_90', round(v_wins_90::numeric, 2),
    'overall_30', round(((v_oura_30 + v_nutr_30 + v_wins_30) / 3.0)::numeric, 2),
    'overall_90', round(((v_oura_90 + v_nutr_90 + v_wins_90) / 3.0)::numeric, 2)
  );

  RETURN v_result;
END;
$$;

-- ── 2. Pin search_path = '' on all application functions (SECURITY DEFINER) ─
ALTER FUNCTION public._recompute_daily_nutrition(p_user_id uuid, p_date date) SET search_path = '';
ALTER FUNCTION public.add_food_entry(p_user_id uuid, p_date date, p_grams integer, p_entry jsonb) SET search_path = '';
ALTER FUNCTION public.cleanup_old_logs() SET search_path = '';
ALTER FUNCTION public.compute_navy_bf() SET search_path = '';
ALTER FUNCTION public.find_entity_seeds_by_embedding(query_embedding vector, match_user_id uuid, match_count integer) SET search_path = '';
ALTER FUNCTION public.find_mentioned_entities(query_text text, user_id_param uuid) SET search_path = '';
ALTER FUNCTION public.get_desktop_dashboard_data(p_user_id uuid) SET search_path = '';
ALTER FUNCTION public.handle_clarification_writeback() SET search_path = '';
ALTER FUNCTION public.oracle_readonly_query(query_text text) SET search_path = '';
ALTER FUNCTION public.remove_food_entry(p_user_id uuid, p_entry_id uuid) SET search_path = '';
ALTER FUNCTION public.repeat_food_entry(p_user_id uuid, p_source_entry_id uuid, p_date date) SET search_path = '';
ALTER FUNCTION public.replace_calendar_window(p_user_id uuid, p_category text, p_start timestamp with time zone, p_end timestamp with time zone, p_events jsonb) SET search_path = '';
ALTER FUNCTION public.save_food_correction(p_user_id uuid, p_query_name text, p_corrected_grams integer, p_corrected_name text) SET search_path = '';
ALTER FUNCTION public.save_workout_atomic(p_user_id uuid, p_day_key character varying, p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_notes text, p_msp_passed boolean, p_logs jsonb, p_session_rpe integer) SET search_path = '';
ALTER FUNCTION public.sync_friction_proposals(p_user_id uuid) SET search_path = '';
ALTER FUNCTION public.sync_link_read_to_growth_pins() SET search_path = '';
ALTER FUNCTION public.sync_todo_done_to_growth_pins() SET search_path = '';
ALTER FUNCTION public.trg_deduplicate_calendar_sleep() SET search_path = '';
ALTER FUNCTION public.trg_sync_oura_sleep_to_calendar() SET search_path = '';
ALTER FUNCTION public.trg_sync_strava_activity_to_calendar() SET search_path = '';
ALTER FUNCTION public.trg_sync_workout_session_to_calendar() SET search_path = '';
ALTER FUNCTION public.trigger_outbound_message_worker() SET search_path = '';
ALTER FUNCTION public.trigger_vanguard_classification() SET search_path = '';
ALTER FUNCTION public.trigger_vanguard_telegram_worker() SET search_path = '';
ALTER FUNCTION public.update_food_entry(p_user_id uuid, p_entry_id uuid, p_entry jsonb) SET search_path = '';
ALTER FUNCTION public.vanguard_graph_cleanup() SET search_path = '';

-- ── 3. Pin search_path = '' on application functions (non-SECURITY-DEFINER) ─
ALTER FUNCTION public.cache_food_to_library(p_user_id uuid, p_name text, p_brand text, p_barcode text, p_calories numeric, p_protein numeric, p_carbs numeric, p_fat numeric, p_fiber numeric, p_sugar numeric, p_default_grams integer) SET search_path = '';
ALTER FUNCTION public.canonicalize_vanguard_entity(p_user_id uuid, p_name text) SET search_path = '';
ALTER FUNCTION public.check_vanguard_relation_ontology() SET search_path = '';
ALTER FUNCTION public.deprecate_superseded_facts(p_user_id uuid, p_source text, p_relation text, p_new_target text, p_new_confidence double precision, p_new_episode_id uuid) SET search_path = '';
ALTER FUNCTION public.get_brain_health_report(user_id_param uuid) SET search_path = '';
ALTER FUNCTION public.get_vanguard_graph_context(start_entities text[], max_depth integer, user_id_param uuid, p_layer text, p_include_historical boolean, p_as_of timestamp with time zone, p_min_confidence double precision) SET search_path = '';
ALTER FUNCTION public.handle_new_entity_alias() SET search_path = '';
ALTER FUNCTION public.increment_kpi_entry_for_week(p_kpi_id uuid, p_week_start date, p_delta numeric) SET search_path = '';
ALTER FUNCTION public.match_vanguard_content(query_embedding vector, match_threshold double precision, match_count integer, user_id_param uuid, max_age_days integer) SET search_path = '';
ALTER FUNCTION public.resolve_entity(p_user_id uuid, p_name text, p_kind text) SET search_path = '';
ALTER FUNCTION public.resolve_entity_decision(p_user_id uuid, p_name text, p_kind text, p_threshold_same double precision, p_threshold_diff double precision, p_gap double precision) SET search_path = '';
ALTER FUNCTION public.resolve_entity_fuzzy_candidates(p_user_id uuid, p_name text, p_kind text) SET search_path = '';
ALTER FUNCTION public.search_entity_links(query_embedding vector, match_user_id uuid, match_count integer) SET search_path = '';
ALTER FUNCTION public.search_entity_links_fulltext(query_text text, match_user_id uuid, match_count integer) SET search_path = '';
ALTER FUNCTION public.sprint_info_for_date(d date) SET search_path = '';
ALTER FUNCTION public.sync_daily_win_tasks_to_daily_wins() SET search_path = '';
ALTER FUNCTION public.sync_daily_wins_to_daily_win_tasks() SET search_path = '';
ALTER FUNCTION public.sync_vanguard_entity_links_to_claims() SET search_path = '';
ALTER FUNCTION public.touch_updated_at() SET search_path = '';
ALTER FUNCTION public.update_daily_plan_updated_at() SET search_path = '';
ALTER FUNCTION public.upsert_vanguard_entity_link(p_user_id uuid, p_source text, p_source_type text, p_relation text, p_target text, p_target_type text, p_confidence_score double precision, p_memory_type text, p_layer text, p_metadata jsonb, p_source_episode_id uuid, p_observed_at timestamp with time zone) SET search_path = '';
ALTER FUNCTION public.verify_vanguard_knowledge() SET search_path = '';
