-- ============================================================
-- P1.3 — vanguard_consolidated_activities was the one ERROR-level advisor
-- finding: a SECURITY DEFINER view (runs with the view creator's privileges,
-- bypassing RLS of the underlying tables for whoever queries it). The view is
-- a plain UNION ALL of behavior_log and workout_sessions with no cross-user
-- logic — no reason for definer semantics. SECURITY INVOKER (view runs as the
-- querying role, respecting RLS normally) is strictly safer and available
-- since Postgres 15.
-- ============================================================

ALTER VIEW public.vanguard_consolidated_activities SET (security_invoker = true);
