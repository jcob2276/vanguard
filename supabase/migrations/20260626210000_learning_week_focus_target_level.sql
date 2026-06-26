ALTER TABLE public.learning_week_focus
    ADD COLUMN IF NOT EXISTS target_level int
    CHECK (target_level IS NULL OR (target_level >= 0 AND target_level <= 5));
