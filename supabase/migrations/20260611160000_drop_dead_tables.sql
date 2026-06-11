-- ============================================================================
-- MIGRATION: 20260611160000_drop_dead_tables
-- Purpose:
--   Drop the 6 dead/orphaned tables from the system since they are empty,
--   have no references in prompts/docs, and have no writers or readers in code.
-- ============================================================================

DROP TABLE IF EXISTS public.vanguard_events CASCADE;
DROP TABLE IF EXISTS public.vanguard_baselines CASCADE;
DROP TABLE IF EXISTS public.vanguard_decisions CASCADE;
DROP TABLE IF EXISTS public.vanguard_iron_rules CASCADE;
DROP TABLE IF EXISTS public.vanguard_repeated_patterns CASCADE;
DROP TABLE IF EXISTS public.vanguard_known_persons CASCADE;
