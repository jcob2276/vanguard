-- ============================================================
-- P1.2 follow-up — cleanup_old_logs() (created earlier this session in Faza 6,
-- 20260711180000_log_retention.sql) inherited the Postgres default PUBLIC
-- EXECUTE grant, same oversight as the other functions fixed above. Caught by
-- get_advisors() after the fact. Low severity (no-arg, only deletes rows
-- already past their 90-day retention window) but same principle applies.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.cleanup_old_logs() FROM PUBLIC;
