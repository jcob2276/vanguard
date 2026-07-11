-- ============================================================
-- FIX: Revoke anon EXECUTE from SECURITY DEFINER functions
-- These functions are callable via REST API by unauthenticated users,
-- which is a security risk (especially oracle_readonly_query which
-- allows arbitrary SQL).
-- ============================================================

-- Most critical: arbitrary SQL query
REVOKE EXECUTE ON FUNCTION public.oracle_readonly_query(text) FROM anon;

-- User data exposure
REVOKE EXECUTE ON FUNCTION public.get_desktop_dashboard_data(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_data_coverage(uuid) FROM anon;

-- Write access
REVOKE EXECUTE ON FUNCTION public.handle_clarification_writeback() FROM anon;
REVOKE EXECUTE ON FUNCTION public._recompute_daily_nutrition(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_friction_proposals(uuid) FROM anon;

-- Trigger functions (should not be callable via RPC)
REVOKE EXECUTE ON FUNCTION public.trigger_outbound_message_worker() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_vanguard_telegram_worker() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_sync_oura_sleep_to_calendar() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_sync_strava_activity_to_calendar() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_sync_workout_session_to_calendar() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_deduplicate_calendar_sleep() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_todo_done_to_growth_pins() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_link_read_to_growth_pins() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_daily_wins_to_daily_win_tasks() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_daily_win_tasks_to_daily_wins() FROM anon;

-- Also revoke from authenticated for trigger functions (they should only be called by service_role)
REVOKE EXECUTE ON FUNCTION public.trigger_outbound_message_worker() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_vanguard_telegram_worker() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_oura_sleep_to_calendar() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_strava_activity_to_calendar() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_workout_session_to_calendar() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_deduplicate_calendar_sleep() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_todo_done_to_growth_pins() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_link_read_to_growth_pins() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_daily_wins_to_daily_win_tasks() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_daily_win_tasks_to_daily_wins() FROM authenticated;
