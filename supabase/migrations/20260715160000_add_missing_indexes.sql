-- ============================================================================
-- Index hardening migration (2026-07-15)
--
-- Fixes from audit:
-- 1. Missing indexes on FK columns (high-traffic tables only)
-- 2. Duplicate unique index on vanguard_behavioral_patterns
-- 3. Redundant partial index on friction_events
--
-- Strategy: only index FKs that are actually queried or joined.
-- Low-traffic columns (daily_wins.task_*_checkpoint_id, etc.) are skipped —
-- they exist for data integrity (FK constraint) but are never WHERE-filtered.
-- ============================================================================

-- ── 1. Drop duplicate/redundant indexes ─────────────────────────────────────

-- Duplicate unique index: idx_vbp_user_signature is redundant with
-- uq_vanguard_behavioral_patterns_user_signature (same columns, same table).
DROP INDEX IF EXISTS public.idx_vbp_user_signature;

-- Redundant: idx_friction_events_status (user_id, status) is a subset of
-- idx_friction_events_status_idx (user_id, status, occurred_at DESC).
DROP INDEX IF EXISTS public.idx_friction_events_status;

-- ── 2. Add missing indexes on high-traffic FK columns ───────────────────────
-- These tables are queried by user_id on every page load / edge function call.
-- Without an index, every query does a sequential scan.

-- ai_chat_messages: queried per oracle chat session
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user_id ON public.ai_chat_messages (user_id);

-- workout_sessions: queried daily (workout logger, dashboard, training load)
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON public.workout_sessions (user_id);

-- exercise_logs: joined from workout_sessions
CREATE INDEX IF NOT EXISTS idx_exercise_logs_session_id ON public.exercise_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_id ON public.exercise_logs (user_id);

-- vanguard_calendar: queried per calendar view
CREATE INDEX IF NOT EXISTS idx_vanguard_calendar_user_id ON public.vanguard_calendar (user_id);

-- body_metrics: queried for body composition charts
CREATE INDEX IF NOT EXISTS idx_body_metrics_user_id ON public.body_metrics (user_id);

-- daily_nutrition: queried for nutrition summary
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_user_id ON public.daily_nutrition (user_id);

-- daily_win_tasks: joined from daily_wins
CREATE INDEX IF NOT EXISTS idx_daily_win_tasks_day_win_id ON public.daily_win_tasks (day_win_id);
CREATE INDEX IF NOT EXISTS idx_daily_win_tasks_user_id ON public.daily_win_tasks (user_id);

-- habits: queried for habit list
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits (user_id);

-- habit_logs: habit_id FK not leading column in any index
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON public.habit_logs (habit_id);

-- kpi_entries: joined from goal_kpis
CREATE INDEX IF NOT EXISTS idx_kpi_entries_kpi_id ON public.kpi_entries (kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_entries_user_id ON public.kpi_entries (user_id);

-- goal_kpis: queried for project KPIs
CREATE INDEX IF NOT EXISTS idx_goal_kpis_project_id ON public.goal_kpis (project_id);
CREATE INDEX IF NOT EXISTS idx_goal_kpis_user_id ON public.goal_kpis (user_id);

-- todo_sections: project_id FK not indexed
CREATE INDEX IF NOT EXISTS idx_todo_sections_project_id ON public.todo_sections (project_id);

-- view_events: high-volume insert table, queried for analytics
CREATE INDEX IF NOT EXISTS idx_view_events_user_id ON public.view_events (user_id);

-- vanguard_daily_aggregates: queried for daily summaries
CREATE INDEX IF NOT EXISTS idx_vanguard_daily_aggregates_user_id ON public.vanguard_daily_aggregates (user_id);

-- progress_photos: queried for photo timeline
CREATE INDEX IF NOT EXISTS idx_progress_photos_user_id ON public.progress_photos (user_id);

-- phone_usage_daily: queried for screen time charts
CREATE INDEX IF NOT EXISTS idx_phone_usage_daily_user_id ON public.phone_usage_daily (user_id);

-- aw_daily_summary: queried for activity watch data
CREATE INDEX IF NOT EXISTS idx_aw_daily_summary_user_id ON public.aw_daily_summary (user_id);

-- endmyopia_prescriptions: queried for prescriptions list
CREATE INDEX IF NOT EXISTS idx_endmyopia_prescriptions_user_id ON public.endmyopia_prescriptions (user_id);

-- medical_documents: queried for medical records
CREATE INDEX IF NOT EXISTS idx_medical_documents_user_id ON public.medical_documents (user_id);

-- nutrition_profile: queried for nutrition settings
CREATE INDEX IF NOT EXISTS idx_nutrition_profile_user_id ON public.nutrition_profile (user_id);

-- morning_briefs: queried for morning brief
CREATE INDEX IF NOT EXISTS idx_morning_briefs_user_id ON public.morning_briefs (user_id);

-- sprint_goals: queried for sprint planning
CREATE INDEX IF NOT EXISTS idx_sprint_goals_user_id ON public.sprint_goals (user_id);

-- life_goals: queried for vision board
CREATE INDEX IF NOT EXISTS idx_life_goals_user_id ON public.life_goals (user_id);

-- strava_tokens: queried for Strava auth
CREATE INDEX IF NOT EXISTS idx_strava_tokens_user_id ON public.strava_tokens (user_id);

-- supplements: queried for supplement list
CREATE INDEX IF NOT EXISTS idx_supplements_user_id ON public.supplements (user_id);

-- push_subscriptions: queried for push notifications
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions (user_id);

-- vanguard_footprint: queried for location data
CREATE INDEX IF NOT EXISTS idx_vanguard_footprint_user_id ON public.vanguard_footprint (user_id);

-- vanguard_identity: queried for identity vault
CREATE INDEX IF NOT EXISTS idx_vanguard_identity_user_id ON public.vanguard_identity (user_id);

-- vanguard_tokens: queried for token management
CREATE INDEX IF NOT EXISTS idx_vanguard_tokens_user_id ON public.vanguard_tokens (user_id);

-- vanguard_llm_usage: queried for LLM usage stats
CREATE INDEX IF NOT EXISTS idx_vanguard_llm_usage_user_id ON public.vanguard_llm_usage (user_id);

-- marathons: queried for marathon tracking
CREATE INDEX IF NOT EXISTS idx_marathons_user_id ON public.marathons (user_id);

-- outbound_messages: queried for message outbox
CREATE INDEX IF NOT EXISTS idx_outbound_messages_user_id ON public.outbound_messages (user_id);

-- ── 3. Graph layer FK indexes (entities, claims, entity_aliases) ────────────
-- These tables form the knowledge graph and have zero FK indexes.
-- Joins on subject_id, object_id, relation_id are common in graph queries.

CREATE INDEX IF NOT EXISTS idx_entities_user_id ON public.entities (user_id);
CREATE INDEX IF NOT EXISTS idx_entities_merged_into ON public.entities (merged_into);

CREATE INDEX IF NOT EXISTS idx_entity_aliases_entity_id ON public.entity_aliases (entity_id);

CREATE INDEX IF NOT EXISTS idx_claims_user_id ON public.claims (user_id);
CREATE INDEX IF NOT EXISTS idx_claims_subject_id ON public.claims (subject_id);
CREATE INDEX IF NOT EXISTS idx_claims_object_id ON public.claims (object_id);
CREATE INDEX IF NOT EXISTS idx_claims_relation_id ON public.claims (relation_id);
CREATE INDEX IF NOT EXISTS idx_claims_superseded_by ON public.claims (superseded_by);

-- ── 4. Miscellaneous FK indexes ─────────────────────────────────────────────

-- pattern_events: FK to vanguard_behavioral_patterns
CREATE INDEX IF NOT EXISTS idx_pattern_events_pattern_id ON public.pattern_events (pattern_id);

-- learning_week_focus: skill_id, subskill_id FKs not leading in any index
CREATE INDEX IF NOT EXISTS idx_learning_week_focus_skill_id ON public.learning_week_focus (skill_id);
CREATE INDEX IF NOT EXISTS idx_learning_week_focus_subskill_id ON public.learning_week_focus (subskill_id);

-- learning_week_pins: skill_id FK not leading in any index
CREATE INDEX IF NOT EXISTS idx_learning_week_pins_skill_id ON public.learning_week_pins (skill_id);

-- learning_skills: parent_id FK not leading in any index
CREATE INDEX IF NOT EXISTS idx_learning_skills_parent_id ON public.learning_skills (parent_id);

-- training_plan_workouts: strava_activity_id FK not indexed
CREATE INDEX IF NOT EXISTS idx_training_plan_workouts_strava_id ON public.training_plan_workouts (strava_activity_id);

-- supplement_logs: supplement_id FK not indexed
CREATE INDEX IF NOT EXISTS idx_supplement_logs_supplement_id ON public.supplement_logs (supplement_id);

-- vanguard_entity_links: relation FK not leading in any index
CREATE INDEX IF NOT EXISTS idx_vanguard_entity_links_relation ON public.vanguard_entity_links (relation);

-- vanguard_eval_results: question_id FK not leading in unique index
CREATE INDEX IF NOT EXISTS idx_vanguard_eval_results_question_id ON public.vanguard_eval_results (question_id);

-- vanguard_wiki_review_items: page_id FK not indexed
CREATE INDEX IF NOT EXISTS idx_vanguard_wiki_review_items_page_id ON public.vanguard_wiki_review_items (page_id);

-- vanguard_wiki_sources: page_id FK not indexed
CREATE INDEX IF NOT EXISTS idx_vanguard_wiki_sources_page_id ON public.vanguard_wiki_sources (page_id);

-- projects: dream_id and user_id FKs not leading in any index
CREATE INDEX IF NOT EXISTS idx_projects_dream_id ON public.projects (dream_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects (user_id);

-- oracle_recommendations: oracle_run_id FK not leading in any index
CREATE INDEX IF NOT EXISTS idx_oracle_recommendations_run_id ON public.oracle_recommendations (oracle_run_id);
