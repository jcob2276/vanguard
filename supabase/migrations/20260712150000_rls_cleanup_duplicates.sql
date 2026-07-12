-- =============================================================================
-- RLS cleanup: drop duplicate policies & fix hardcoded UUID
-- Generated 2026-07-12
--
-- Problem: baseline migration (20260504000000) created 2-3 overlapping user
-- policies on many tables (e.g. "Users can manage their own X" + "Users own X").
-- No DROP POLICY was ever issued, so all copies remain active.
-- Also: one policy has a hardcoded user UUID instead of auth.uid().
--
-- Strategy: DROP the weaker/duplicate policy, KEEP the most complete one.
-- Where a table has split CRUD policies (DELETE/INSERT/UPDATE/SELECT) plus a
-- single MANAGE policy, DROP the splits — the MANAGE policy covers them all.
-- =============================================================================

-- 1. daily_wins — keep "Users can manage their own daily wins", drop "Users own daily wins"
DROP POLICY IF EXISTS "Users own daily wins" ON public.daily_wins;

-- 2. daily_nutrition — keep "own_data" (has both USING + WITH CHECK), drop the two USING-only duplicates
DROP POLICY IF EXISTS "Users can manage their own nutrition data" ON public.daily_nutrition;
DROP POLICY IF EXISTS "Users own nutrition" ON public.daily_nutrition;

-- 3. oura_daily_summary — keep "Users manage own oura", drop "Users own oura data"
DROP POLICY IF EXISTS "Users own oura data" ON public.oura_daily_summary;

-- 4. user_fundament — keep "Users manage own fundament" (has USING + WITH CHECK), drop USING-only
DROP POLICY IF EXISTS "Users own fundament" ON public.user_fundament;

-- 5. vanguard_behavioral_patterns — keep "Users can manage own behavioral patterns", drop "owner_all"
DROP POLICY IF EXISTS "owner_all" ON public.vanguard_behavioral_patterns;

-- 6. vanguard_entity_links — DROP hardcoded-UUID "Dashboard read access", keep "Users own their links"
DROP POLICY IF EXISTS "Dashboard read access" ON public.vanguard_entity_links;

-- 7. todo_sections — keep "todo_sections_owner" (MANAGE), drop split CRUD policies
DROP POLICY IF EXISTS "todo_sections_insert" ON public.todo_sections;
DROP POLICY IF EXISTS "todo_sections_select" ON public.todo_sections;
DROP POLICY IF EXISTS "todo_sections_update" ON public.todo_sections;

-- 8. endmyopia_prescriptions — keep split CRUD (they're fine individually), no action needed
--    (4 policies for 4 operations is valid, not duplicates)

-- 9. daily_food_entries — keep "own_data" (has USING + WITH CHECK), drop USING-only
DROP POLICY IF EXISTS "Users can manage their own food entries" ON public.daily_food_entries;

-- 10. daily_reconciliations — keep "Users see own reconciliations", no duplicate found
--     (only one user policy)

-- 11. vanguard_behavioral_patterns — also has "Service role bypass" from baseline + "owner_all"
--     We already dropped "owner_all". The service_role policy stays.

-- 12. todo_items — has split CRUD (delete/insert/select/update) — keep them, they're not duplicates

-- 13. endmyopia_prescriptions — has split CRUD — keep them

-- 14. marathons — has split CRUD (select/insert/update/delete) — keep them

-- Summary of drops:
--   daily_wins:           1 policy dropped (was 3 → now 2: service_role + user)
--   daily_nutrition:      2 policies dropped (was 4 → now 2: service_role + user)
--   oura_daily_summary:   1 policy dropped (was 3 → now 2: service_role + user)
--   user_fundament:       1 policy dropped (was 3 → now 2: service_role + user)
--   vanguard_behavioral_patterns: 1 policy dropped (was 3 → now 2: service_role + user)
--   vanguard_entity_links: 1 policy dropped (was 2 → now 1: user only; service_role bypass stays)
--   todo_sections:        3 policies dropped (was 5 → now 2: service_role + user MANAGE)
--   daily_food_entries:   1 policy dropped (was 2 → now 1: user only)
--   ------------------------------------------------
--   Total: 11 duplicate policies dropped
