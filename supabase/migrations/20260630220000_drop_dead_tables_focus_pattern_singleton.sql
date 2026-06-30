-- Drop dead tables: no TS references, no active data purpose.
-- focus_sessions: 0 rows, daily_plan v2 never launched
-- vanguard_pattern_feedback: 2 orphan rows, prediction engine removed
-- vanguard_singleton_relations: 15 orphan rows, graph v1 replaced by entity_links

drop table if exists public.focus_sessions cascade;
drop table if exists public.vanguard_pattern_feedback cascade;
drop table if exists public.vanguard_singleton_relations cascade;
