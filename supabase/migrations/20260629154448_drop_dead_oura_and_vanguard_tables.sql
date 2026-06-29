-- Drop dead/unused tables that were verified as inactive
DROP TABLE IF EXISTS public.oura_activity_met_timeline CASCADE;
DROP TABLE IF EXISTS public.oura_sessions CASCADE;
DROP TABLE IF EXISTS public.oura_workouts CASCADE;
DROP TABLE IF EXISTS public.vanguard_goal_alignment CASCADE;

-- Drop orphaned/unused RPC functions (from older features)
DROP FUNCTION IF EXISTS public.replace_daily_food_entries(uuid, date, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.vanguard_graph_cleanup() CASCADE;
DROP FUNCTION IF EXISTS public.canonicalize_vanguard_entity(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.compute_lag_correlations(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.normalize_relation(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.clean_old_vanguard_logs() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_daily_snapshots(text) CASCADE;
