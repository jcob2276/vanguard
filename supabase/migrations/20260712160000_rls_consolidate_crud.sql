-- ============================================================
-- RLS Consolidation: Replace split CRUD policies with a single ALL (manage) policy
-- ============================================================

-- 1. public.dreams
DROP POLICY IF EXISTS "dreams_select" ON public.dreams;
DROP POLICY IF EXISTS "dreams_insert" ON public.dreams;
DROP POLICY IF EXISTS "dreams_update" ON public.dreams;
DROP POLICY IF EXISTS "dreams_delete" ON public.dreams;

CREATE POLICY "manage_own" ON public.dreams
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. public.todo_items
DROP POLICY IF EXISTS "todo_items_select" ON public.todo_items;
DROP POLICY IF EXISTS "todo_items_insert" ON public.todo_items;
DROP POLICY IF EXISTS "todo_items_update" ON public.todo_items;
DROP POLICY IF EXISTS "todo_items_delete" ON public.todo_items;

CREATE POLICY "manage_own" ON public.todo_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. public.marathons
DROP POLICY IF EXISTS "Users can select their own marathons" ON public.marathons;
DROP POLICY IF EXISTS "Users can insert their own marathons" ON public.marathons;
DROP POLICY IF EXISTS "Users can update their own marathons" ON public.marathons;
DROP POLICY IF EXISTS "Users can delete their own marathons" ON public.marathons;

CREATE POLICY "manage_own" ON public.marathons
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. public.body_composition_measurements
DROP POLICY IF EXISTS "bcm_select" ON public.body_composition_measurements;
DROP POLICY IF EXISTS "bcm_insert" ON public.body_composition_measurements;
DROP POLICY IF EXISTS "bcm_update" ON public.body_composition_measurements;
DROP POLICY IF EXISTS "bcm_delete" ON public.body_composition_measurements;

CREATE POLICY "manage_own" ON public.body_composition_measurements
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. public.medical_documents
DROP POLICY IF EXISTS "md_select" ON public.medical_documents;
DROP POLICY IF EXISTS "md_insert" ON public.medical_documents;
DROP POLICY IF EXISTS "md_update" ON public.medical_documents;
DROP POLICY IF EXISTS "md_delete" ON public.medical_documents;

CREATE POLICY "manage_own" ON public.medical_documents
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. public.medical_lab_results
DROP POLICY IF EXISTS "mlr_select" ON public.medical_lab_results;
DROP POLICY IF EXISTS "mlr_insert" ON public.medical_lab_results;
DROP POLICY IF EXISTS "mlr_update" ON public.medical_lab_results;
DROP POLICY IF EXISTS "mlr_delete" ON public.medical_lab_results;

CREATE POLICY "manage_own" ON public.medical_lab_results
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. public.nutrition_profile
DROP POLICY IF EXISTS "np_select" ON public.nutrition_profile;
DROP POLICY IF EXISTS "np_insert" ON public.nutrition_profile;
DROP POLICY IF EXISTS "np_update" ON public.nutrition_profile;
DROP POLICY IF EXISTS "np_delete" ON public.nutrition_profile;

CREATE POLICY "manage_own" ON public.nutrition_profile
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. public.nutrition_targets
DROP POLICY IF EXISTS "nt_select" ON public.nutrition_targets;
DROP POLICY IF EXISTS "nt_insert" ON public.nutrition_targets;
DROP POLICY IF EXISTS "nt_update" ON public.nutrition_targets;
DROP POLICY IF EXISTS "nt_delete" ON public.nutrition_targets;

CREATE POLICY "manage_own" ON public.nutrition_targets
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 9. public.fasting_logs
DROP POLICY IF EXISTS "user_select" ON public.fasting_logs;
DROP POLICY IF EXISTS "user_insert" ON public.fasting_logs;
DROP POLICY IF EXISTS "user_update" ON public.fasting_logs;
DROP POLICY IF EXISTS "user_delete" ON public.fasting_logs;

CREATE POLICY "manage_own" ON public.fasting_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. public.vision_board_items
DROP POLICY IF EXISTS "vbi_select" ON public.vision_board_items;
DROP POLICY IF EXISTS "vbi_insert" ON public.vision_board_items;
DROP POLICY IF EXISTS "vbi_update" ON public.vision_board_items;
DROP POLICY IF EXISTS "vbi_delete" ON public.vision_board_items;

CREATE POLICY "manage_own" ON public.vision_board_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 11. public.weekly_reviews
DROP POLICY IF EXISTS "weekly_reviews_select" ON public.weekly_reviews;
DROP POLICY IF EXISTS "weekly_reviews_insert" ON public.weekly_reviews;
DROP POLICY IF EXISTS "weekly_reviews_update" ON public.weekly_reviews;
DROP POLICY IF EXISTS "weekly_reviews_delete" ON public.weekly_reviews;

CREATE POLICY "manage_own" ON public.weekly_reviews
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 12. public.endmyopia_prescriptions
DROP POLICY IF EXISTS "Users can view own prescriptions" ON public.endmyopia_prescriptions;
DROP POLICY IF EXISTS "Users can insert own prescriptions" ON public.endmyopia_prescriptions;
DROP POLICY IF EXISTS "Users can update own prescriptions" ON public.endmyopia_prescriptions;
DROP POLICY IF EXISTS "Users can delete own prescriptions" ON public.endmyopia_prescriptions;

CREATE POLICY "manage_own" ON public.endmyopia_prescriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
