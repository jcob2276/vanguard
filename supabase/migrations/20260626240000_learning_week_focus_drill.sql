ALTER TABLE public.learning_week_focus
    ADD COLUMN IF NOT EXISTS subskill_id uuid REFERENCES public.learning_skills(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS drill_text text NOT NULL DEFAULT '';
