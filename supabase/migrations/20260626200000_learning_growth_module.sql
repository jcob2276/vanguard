-- Rozwój module: skills, snapshots, weekly plan pins

CREATE TABLE IF NOT EXISTS public.learning_skills (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key         text NOT NULL,
    label       text NOT NULL,
    sort_order  int NOT NULL DEFAULT 0,
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, key)
);

CREATE TABLE IF NOT EXISTS public.learning_skill_snapshots (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot_date  date NOT NULL,
    scores         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS public.learning_week_focus (
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start  date NOT NULL,
    skill_id    uuid REFERENCES public.learning_skills(id) ON DELETE SET NULL,
    why_text    text NOT NULL DEFAULT '',
    PRIMARY KEY (user_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.learning_week_pins (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start           date NOT NULL,
    entity_type          text NOT NULL CHECK (entity_type IN ('link', 'todo', 'manual')),
    entity_id            uuid,
    manual_title         text,
    manual_resource_type text,
    skill_id             uuid REFERENCES public.learning_skills(id) ON DELETE SET NULL,
    slot                 text NOT NULL CHECK (slot IN ('must', 'active')),
    sort_order           int NOT NULL DEFAULT 0,
    done                 boolean NOT NULL DEFAULT false,
    done_at              timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT learning_week_pins_manual_title_chk CHECK (
        entity_type <> 'manual' OR (manual_title IS NOT NULL AND length(trim(manual_title)) > 0)
    )
);

ALTER TABLE public.vanguard_links
    ADD COLUMN IF NOT EXISTS resource_type text,
    ADD COLUMN IF NOT EXISTS pillar text;

ALTER TABLE public.learning_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_skill_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_week_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_week_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own learning_skills" ON public.learning_skills;
CREATE POLICY "Users manage own learning_skills"
    ON public.learning_skills FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own learning_skill_snapshots" ON public.learning_skill_snapshots;
CREATE POLICY "Users manage own learning_skill_snapshots"
    ON public.learning_skill_snapshots FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own learning_week_focus" ON public.learning_week_focus;
CREATE POLICY "Users manage own learning_week_focus"
    ON public.learning_week_focus FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own learning_week_pins" ON public.learning_week_pins;
CREATE POLICY "Users manage own learning_week_pins"
    ON public.learning_week_pins FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_learning_skills_user_active
    ON public.learning_skills (user_id, active, sort_order);

CREATE INDEX IF NOT EXISTS idx_learning_skill_snapshots_user_date
    ON public.learning_skill_snapshots (user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_learning_week_pins_user_week
    ON public.learning_week_pins (user_id, week_start, slot, sort_order);

CREATE INDEX IF NOT EXISTS idx_learning_week_focus_user_week
    ON public.learning_week_focus (user_id, week_start);
