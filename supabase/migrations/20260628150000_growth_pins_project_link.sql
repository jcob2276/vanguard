-- Link weekly growth pins (MUST/ACTIVE) to the project they actually serve.
-- Without this, "Rozwój" and "Projekty" are two parallel systems with no real relation —
-- a MUST can claim to move a project's KPI but nothing in the data enforces or shows it.

ALTER TABLE public.learning_week_pins
    ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_learning_week_pins_project
    ON public.learning_week_pins (project_id);
