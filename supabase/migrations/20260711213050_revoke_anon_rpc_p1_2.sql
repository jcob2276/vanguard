-- ============================================================
-- P1.2 — REVOKE anon/authenticated EXECUTE on SECURITY DEFINER functions
-- with no legitimate REST/RPC caller.
-- ============================================================
-- Verified before revoking (not guessed):
-- - Trigger functions (compute_navy_bf, handle_clarification_writeback, and all
--   trg_*/trigger_*/sync_*_to_growth_pins below) RETURN trigger or are invoked
--   only by trigger machinery — Postgres does not require EXECUTE privilege on
--   the invoking role for trigger-fired execution, only for direct CALL/RPC.
-- - _recompute_daily_nutrition(uuid, date) and oracle_readonly_query(text) take
--   arbitrary user-controlled params (p_user_id / raw SQL) with zero matches in
--   `grep .rpc(` across src/ — no frontend caller, pure attack surface.
-- - sync_friction_proposals(uuid) IS called from src/lib/systemProposals.ts and
--   is intentionally left untouched (anon already false, authenticated correct).

REVOKE EXECUTE ON FUNCTION public._recompute_daily_nutrition(uuid, date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_navy_bf() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_clarification_writeback() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.oracle_readonly_query(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_link_read_to_growth_pins() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_todo_done_to_growth_pins() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_deduplicate_calendar_sleep() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_oura_sleep_to_calendar() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_strava_activity_to_calendar() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_workout_session_to_calendar() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_outbound_message_worker() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_vanguard_telegram_worker() FROM anon, authenticated;
