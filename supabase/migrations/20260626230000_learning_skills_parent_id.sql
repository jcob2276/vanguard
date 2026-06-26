-- Hierarchia skilli: skill życiowy (parent) + pod-skilli (parent_id)

ALTER TABLE public.learning_skills
    ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.learning_skills(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_learning_skills_parent
    ON public.learning_skills (user_id, parent_id, sort_order)
    WHERE active = true;
