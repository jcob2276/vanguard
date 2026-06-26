ALTER TABLE public.learning_week_focus
    ADD COLUMN IF NOT EXISTS rep_target int
        CHECK (rep_target IS NULL OR (rep_target >= 1 AND rep_target <= 999)),
    ADD COLUMN IF NOT EXISTS rep_done int NOT NULL DEFAULT 0
        CHECK (rep_done >= 0 AND rep_done <= 9999),
    ADD COLUMN IF NOT EXISTS lateral_challenge text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS vertical_challenge text NOT NULL DEFAULT '';
