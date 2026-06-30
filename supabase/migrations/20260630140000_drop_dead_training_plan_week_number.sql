-- week_number was a static label from the original coach-seeded plan (anchor 2026-05-19),
-- using a numbering independent of the personal sprint cycle (anchor 2026-03-01). It was
-- never displayed anywhere in the UI and unused even in its only reader
-- (analyze-training-load selected it but never referenced it when building the LLM prompt).
-- Dropping it removes the only place the two week-numbering systems could ever collide.
alter table public.training_plan_workouts drop column week_number;
