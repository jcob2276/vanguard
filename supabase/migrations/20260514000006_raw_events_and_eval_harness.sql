-- Vanguard long-horizon memory foundation.
-- 1) raw_events keeps immutable source material for future re-processing.
-- 2) eval_* tables make Oracle changes measurable before more prompt/features work.

CREATE TABLE IF NOT EXISTS public.vanguard_raw_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source text NOT NULL,
    source_ref text,
    event_type text NOT NULL DEFAULT 'note',
    raw_text text,
    raw_hash text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    language text NOT NULL DEFAULT 'pl',
    occurred_at timestamptz,
    ingested_at timestamptz NOT NULL DEFAULT now(),
    processing_status text NOT NULL DEFAULT 'pending',
    schema_version integer NOT NULL DEFAULT 1,
    CONSTRAINT vanguard_raw_events_processing_status_check
        CHECK (processing_status IN ('pending', 'processed', 'failed', 'ignored')),
    CONSTRAINT vanguard_raw_events_source_check
        CHECK (length(btrim(source)) > 0)
);

ALTER TABLE public.vanguard_raw_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'vanguard_raw_events'
          AND policyname = 'Users own raw events'
    ) THEN
        CREATE POLICY "Users own raw events"
        ON public.vanguard_raw_events
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_vanguard_raw_events_user_ingested
    ON public.vanguard_raw_events(user_id, ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_vanguard_raw_events_user_occurred
    ON public.vanguard_raw_events(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_vanguard_raw_events_user_source
    ON public.vanguard_raw_events(user_id, source, event_type);

CREATE INDEX IF NOT EXISTS idx_vanguard_raw_events_payload_gin
    ON public.vanguard_raw_events USING gin(payload);

CREATE INDEX IF NOT EXISTS idx_vanguard_raw_events_metadata_gin
    ON public.vanguard_raw_events USING gin(metadata);

CREATE UNIQUE INDEX IF NOT EXISTS ux_vanguard_raw_events_source_ref
    ON public.vanguard_raw_events(user_id, source, source_ref)
    WHERE source_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vanguard_raw_events_hash
    ON public.vanguard_raw_events(user_id, raw_hash)
    WHERE raw_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.vanguard_eval_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    suite text NOT NULL DEFAULT 'core',
    question text NOT NULL,
    expected_answer text,
    expected_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
    expected_claims jsonb NOT NULL DEFAULT '[]'::jsonb,
    tags text[] NOT NULL DEFAULT '{}'::text[],
    difficulty text NOT NULL DEFAULT 'medium',
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vanguard_eval_questions_difficulty_check
        CHECK (difficulty IN ('easy', 'medium', 'hard', 'adversarial'))
);

ALTER TABLE public.vanguard_eval_questions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'vanguard_eval_questions'
          AND policyname = 'Users own eval questions'
    ) THEN
        CREATE POLICY "Users own eval questions"
        ON public.vanguard_eval_questions
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_vanguard_eval_questions_user_suite
    ON public.vanguard_eval_questions(user_id, suite, is_active);

CREATE INDEX IF NOT EXISTS idx_vanguard_eval_questions_tags
    ON public.vanguard_eval_questions USING gin(tags);

CREATE TABLE IF NOT EXISTS public.vanguard_eval_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    suite text NOT NULL DEFAULT 'core',
    model text,
    oracle_version text,
    status text NOT NULL DEFAULT 'running',
    summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    CONSTRAINT vanguard_eval_runs_status_check
        CHECK (status IN ('running', 'passed', 'failed', 'error'))
);

ALTER TABLE public.vanguard_eval_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'vanguard_eval_runs'
          AND policyname = 'Users own eval runs'
    ) THEN
        CREATE POLICY "Users own eval runs"
        ON public.vanguard_eval_runs
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_vanguard_eval_runs_user_started
    ON public.vanguard_eval_runs(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.vanguard_eval_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.vanguard_eval_runs(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id uuid REFERENCES public.vanguard_eval_questions(id) ON DELETE SET NULL,
    question text NOT NULL,
    answer text,
    score numeric,
    passed boolean,
    sources jsonb NOT NULL DEFAULT '[]'::jsonb,
    claims jsonb NOT NULL DEFAULT '[]'::jsonb,
    raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
    judge_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vanguard_eval_results_score_check
        CHECK (score IS NULL OR (score >= 0 AND score <= 1))
);

ALTER TABLE public.vanguard_eval_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'vanguard_eval_results'
          AND policyname = 'Users own eval results'
    ) THEN
        CREATE POLICY "Users own eval results"
        ON public.vanguard_eval_results
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_vanguard_eval_results_run
    ON public.vanguard_eval_results(run_id);

CREATE INDEX IF NOT EXISTS idx_vanguard_eval_results_user_created
    ON public.vanguard_eval_results(user_id, created_at DESC);
