-- Phase 1: link daily win slots to checkpoints, projects, week MUST pins
-- Phase 4: explicit project → skill mapping

ALTER TABLE public.daily_wins
  ADD COLUMN IF NOT EXISTS task_1_checkpoint_id uuid REFERENCES public.project_checkpoints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_2_checkpoint_id uuid REFERENCES public.project_checkpoints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_3_checkpoint_id uuid REFERENCES public.project_checkpoints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_4_checkpoint_id uuid REFERENCES public.project_checkpoints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_5_checkpoint_id uuid REFERENCES public.project_checkpoints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_1_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_2_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_3_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_4_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_5_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_1_pin_id uuid REFERENCES public.learning_week_pins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_2_pin_id uuid REFERENCES public.learning_week_pins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_3_pin_id uuid REFERENCES public.learning_week_pins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_4_pin_id uuid REFERENCES public.learning_week_pins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_5_pin_id uuid REFERENCES public.learning_week_pins(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS primary_skill_id uuid REFERENCES public.learning_skills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_wins_task_checkpoint
  ON public.daily_wins (user_id, task_1_checkpoint_id)
  WHERE task_1_checkpoint_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_primary_skill
  ON public.projects (primary_skill_id)
  WHERE primary_skill_id IS NOT NULL;
