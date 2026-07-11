-- ============================================================
-- P1.2 correction — 20260711213249_revoke_cleanup_old_logs_public.sql (REVOKE
-- ... FROM PUBLIC) was a no-op: has_function_privilege() after applying it
-- still showed anon_exec=true, auth_exec=true. pg_proc.proacl showed cleanup_old_logs
-- had EXPLICIT direct grants to anon/authenticated (not just the inherited
-- PUBLIC default) — Supabase grants EXECUTE to anon/authenticated/service_role
-- by default on new functions created in the public schema, which is a
-- different ACL entry than PUBLIC and REVOKE FROM PUBLIC does not touch it.
-- This is the actual fix; verified anon_exec=false, auth_exec=false,
-- service_exec=true afterward.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.cleanup_old_logs() FROM anon, authenticated;
