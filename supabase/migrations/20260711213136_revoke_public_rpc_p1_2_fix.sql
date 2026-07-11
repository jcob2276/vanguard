-- ============================================================
-- P1.2 FIX — the previous REVOKE (20260711223000) targeted anon/authenticated
-- directly and was a no-op for 11 of 12 functions: their EXECUTE grant comes
-- from the Postgres default `PUBLIC` privilege (every new function is
-- EXECUTE-able by PUBLIC unless explicitly restricted), which anon/authenticated
-- inherit regardless of any REVOKE aimed at them specifically. Verified via
-- has_function_privilege() after the first migration — 11/12 still showed
-- anon_exec=true, auth_exec=true. REVOKE FROM PUBLIC is the actual fix.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public._recompute_daily_nutrition(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_navy_bf() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_clarification_writeback() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_link_read_to_growth_pins() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_todo_done_to_growth_pins() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_deduplicate_calendar_sleep() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_oura_sleep_to_calendar() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_strava_activity_to_calendar() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_workout_session_to_calendar() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_outbound_message_worker() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_vanguard_telegram_worker() FROM PUBLIC;
