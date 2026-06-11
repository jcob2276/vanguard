-- Drop dead prediction/YouTube artifacts.
--
-- Runtime read/write paths removed in the same change:
-- - VanguardCore.computePredictions() -> vanguard_correlations
-- - VanguardCore.analyzeInterventions() -> vanguard_temporal_links
-- - sync-calendar YouTube activity branch -> vanguard_youtube
--
-- These were ghost features with no active product surface.

DROP TABLE IF EXISTS public.vanguard_temporal_links;
DROP TABLE IF EXISTS public.vanguard_correlations;
DROP TABLE IF EXISTS public.vanguard_youtube;
