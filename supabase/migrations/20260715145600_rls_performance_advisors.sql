-- =============================================================================
-- RLS Performance advisor improvements
-- Dropping duplicate policy on weekly_reviews and wrapping auth.uid() in (select auth.uid())
-- Created 2026-07-15
-- =============================================================================

-- 1. Drop duplicate policy on public.weekly_reviews
DROP POLICY IF EXISTS "Users can manage their own weekly reviews" ON public.weekly_reviews;

-- 2. Optimize public tables (wrapping auth.uid() in subqueries)
DROP POLICY IF EXISTS "manage_own" ON public.dreams;
CREATE POLICY "manage_own" ON public.dreams FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "manage_own" ON public.todo_items;
CREATE POLICY "manage_own" ON public.todo_items FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "manage_own" ON public.marathons;
CREATE POLICY "manage_own" ON public.marathons FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "manage_own" ON public.body_composition_measurements;
CREATE POLICY "manage_own" ON public.body_composition_measurements FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "manage_own" ON public.medical_documents;
CREATE POLICY "manage_own" ON public.medical_documents FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "manage_own" ON public.medical_lab_results;
CREATE POLICY "manage_own" ON public.medical_lab_results FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "manage_own" ON public.nutrition_profile;
CREATE POLICY "manage_own" ON public.nutrition_profile FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "manage_own" ON public.nutrition_targets;
CREATE POLICY "manage_own" ON public.nutrition_targets FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "manage_own" ON public.fasting_logs;
CREATE POLICY "manage_own" ON public.fasting_logs FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "manage_own" ON public.vision_board_items;
CREATE POLICY "manage_own" ON public.vision_board_items FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "manage_own" ON public.weekly_reviews;
CREATE POLICY "manage_own" ON public.weekly_reviews FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "manage_own" ON public.endmyopia_prescriptions;
CREATE POLICY "manage_own" ON public.endmyopia_prescriptions FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- 3. Optimize graveyard tables (wrapping auth.uid() in subqueries)
DROP POLICY IF EXISTS "Users can manage their own habits" ON graveyard.daily_habits;
CREATE POLICY "Users can manage their own habits" ON graveyard.daily_habits FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own recipes" ON graveyard.vanguard_recipes;
CREATE POLICY "Users can manage their own recipes" ON graveyard.vanguard_recipes FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users see own closure proposals" ON graveyard.vanguard_stream_closure_proposals;
CREATE POLICY "Users see own closure proposals" ON graveyard.vanguard_stream_closure_proposals FOR ALL USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "user_portions_read" ON graveyard.user_portions;
CREATE POLICY "user_portions_read" ON graveyard.user_portions FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_portions_insert" ON graveyard.user_portions;
CREATE POLICY "user_portions_insert" ON graveyard.user_portions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_portions_update" ON graveyard.user_portions;
CREATE POLICY "user_portions_update" ON graveyard.user_portions FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_portions_delete" ON graveyard.user_portions;
CREATE POLICY "user_portions_delete" ON graveyard.user_portions FOR DELETE USING ((select auth.uid()) = user_id);
