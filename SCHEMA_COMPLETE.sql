-- ============================================================
-- VANGUARD OS — KOMPLETNY SCHEMAT BAZY DANYCH
-- Wersja: 6.4 | Data: 2026-05-11
--
-- Ten plik zawiera PEŁNY stan bazy od zera.
-- Uruchom jednorazowo na czystej bazie Supabase.
-- Wszystkie instrukcje są idempotentne (IF NOT EXISTS).
-- ============================================================

-- WYMAGANE ROZSZERZENIA
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SEKCJA 1: TABELE TRENINGOWE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workout_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workout_day VARCHAR(10) NOT NULL,       -- 'A', 'B', 'C', 'D'
    date DATE DEFAULT CURRENT_DATE,
    duration_minutes INTEGER,
    session_notes TEXT,
    msp_passed BOOLEAN DEFAULT FALSE,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    embedding vector(1536),
    importance_score INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.exercise_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_name VARCHAR(100) NOT NULL,
    set_number INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight DECIMAL(5,2),
    rpe DECIMAL(3,1),
    is_pws_or_msp BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.daily_habits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    couch_stretch BOOLEAN DEFAULT FALSE,
    chin_tucks BOOLEAN DEFAULT FALSE,
    glute_bridge BOOLEAN DEFAULT FALSE,
    child_pose BOOLEAN DEFAULT FALSE,
    bar_hang BOOLEAN DEFAULT FALSE,
    protein_170g BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, date)
);

-- ============================================================
-- SEKCJA 2: DANE ZDROWOTNE I BIOMETRYCZNE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.body_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    weight DECIMAL(5,2),
    waist DECIMAL(5,2),
    neck DECIMAL(5,2),
    chest DECIMAL(5,2),
    hips DECIMAL(5,2),
    belly DECIMAL(5,2),
    biceps_l DECIMAL(5,2),
    biceps_r DECIMAL(5,2),
    forearm DECIMAL(5,2),
    thigh DECIMAL(5,2),
    calf DECIMAL(5,2),
    body_fat DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.oura_daily_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    readiness_score INTEGER,
    total_sleep_hours DECIMAL(4,2),
    deep_sleep_hours DECIMAL(4,2),
    rem_sleep_hours DECIMAL(4,2),
    sleep_efficiency INTEGER,
    latency_minutes INTEGER,
    hrv_avg INTEGER,
    rhr_avg INTEGER,
    temp_deviation DECIMAL(4,2),
    steps INTEGER,
    bedtime_timestamp TIMESTAMP WITH TIME ZONE,
    is_disciplined BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.progress_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================
-- SEKCJA 3: ŻYWIENIE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.daily_nutrition (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    calories INTEGER,
    protein DECIMAL(5,2),
    carbs DECIMAL(5,2),
    fat DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.daily_food_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    name TEXT NOT NULL,
    calories INTEGER,
    protein DECIMAL(5,2),
    carbs DECIMAL(5,2),
    fat DECIMAL(5,2),
    meal_type TEXT,     -- 'breakfast', 'lunch', 'dinner', 'snack'
    amount TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT unique_user_date_name_meal UNIQUE (user_id, date, name, meal_type)
);

-- ============================================================
-- SEKCJA 4: ZACHOWANIE I PSYCHOLOGIA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.life_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_cialo TEXT DEFAULT 'Zdefiniuj cel dla ciała',
    goal_duch TEXT DEFAULT 'Zdefiniuj cel dla ducha',
    goal_konto TEXT DEFAULT 'Zdefiniuj cel dla konta',
    date_cialo DATE,
    date_duch DATE,
    date_konto DATE,
    about_me TEXT DEFAULT '',
    vault_content TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.daily_wins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    task_1 TEXT, category_1 TEXT, done_1 BOOLEAN DEFAULT FALSE,
    task_2 TEXT, category_2 TEXT, done_2 BOOLEAN DEFAULT FALSE,
    task_3 TEXT, category_3 TEXT, done_3 BOOLEAN DEFAULT FALSE,
    task_4 TEXT, category_4 TEXT, done_4 BOOLEAN DEFAULT FALSE,
    task_5 TEXT, category_5 TEXT, done_5 BOOLEAN DEFAULT FALSE,
    result VARCHAR(1),                  -- 'Z' (Win), 'P' (Loss)
    mood_score INTEGER,                 -- 1-5
    journal_entry TEXT,
    gratitude_entry TEXT,
    discipline_score INTEGER,
    is_intervention BOOLEAN DEFAULT FALSE,
    embedding vector(1536),
    importance_score INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    proud_of TEXT,
    sabotage TEXT,
    do_differently TEXT,
    embedding vector(1536),
    importance_score INTEGER DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.user_fundament (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    identity TEXT DEFAULT '',
    philosophy TEXT DEFAULT '',
    vision TEXT DEFAULT '',
    finances TEXT DEFAULT '',
    knowledge TEXT DEFAULT '',
    relationships TEXT DEFAULT '',
    embedding vector(1536),
    importance_score INTEGER DEFAULT 10,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================
-- SEKCJA 5: LOKALIZACJA I AKTYWNOŚĆ CYFROWA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.location_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    place_name TEXT,
    is_manual BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, created_at)
);

CREATE TABLE IF NOT EXISTS public.stayfree_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    app_name TEXT NOT NULL,
    device_name TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    unlocks INTEGER NOT NULL,
    launches INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, date, app_name, device_name)
);

-- ============================================================
-- SEKCJA 6: VANGUARD OS — SILNIK BEHAWIORALNY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vanguard_daily_aggregates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    -- Execution
    execution_score FLOAT,
    identity_score INTEGER,
    power_list_result TEXT,
    -- Biometria (z Oura)
    readiness_score FLOAT,
    sleep_hours FLOAT,
    hrv_avg FLOAT,
    rhr_avg FLOAT,
    temp_deviation FLOAT,
    -- Cyfrowe (z StayFree)
    screen_time_min FLOAT,
    dopamine_load_index FLOAT,
    fragmentation_index FLOAT,
    -- Stan
    final_state TEXT,
    state_confidence FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.vanguard_identity (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    behavioral_baseline JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.vanguard_correlations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    signal_name TEXT NOT NULL,
    lag_days INTEGER NOT NULL,
    r_value FLOAT NOT NULL,
    sample_size INTEGER NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, signal_name, lag_days)
);

CREATE TABLE IF NOT EXISTS public.vanguard_goal_alignment (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    date DATE NOT NULL,
    alignment_score FLOAT NOT NULL,
    drift_score FLOAT NOT NULL,
    wasted_time_min INTEGER DEFAULT 0,
    primary_leak TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.vanguard_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    name TEXT,
    signature_sequence JSONB,
    biometric_context JSONB,
    outcome_state TEXT,
    lead_time_min INTEGER,
    occurrence_count INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vanguard_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    title TEXT,
    content TEXT,
    source_type TEXT,           -- 'BOOK', 'COURSE', 'PDF', 'THOUGHT'
    tags TEXT[],
    importance_score INTEGER DEFAULT 5,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vanguard_temporal_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    source_date DATE NOT NULL,
    target_date DATE NOT NULL,
    link_type TEXT CHECK (link_type IN ('CAUSAL', 'RECOVERY', 'DEGRADATION', 'INTERVENTION')),
    description TEXT,
    strength FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vanguard_stream (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT,                -- 'telegram', 'app', 'voice'
    content TEXT NOT NULL,
    classification TEXT,        -- 'thought', 'decision', 'idea', 'chaos', 'insight'
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================
-- SEKCJA 7: CHAT AI
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,         -- 'user' | 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================
-- SEKCJA 8: USTAWIENIA UŻYTKOWNIKA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Oura
    oura_token TEXT,
    -- Yazio
    yazio_username TEXT,
    yazio_password TEXT,
    yazio_token TEXT,
    -- Google Fit
    google_fit_client_id TEXT,
    google_fit_client_secret TEXT,
    google_fit_refresh_token TEXT,
    -- Lokalizacja (POI)
    home_lat DECIMAL(9,6),
    home_lng DECIMAL(9,6),
    work_lat DECIMAL(9,6),
    work_lng DECIMAL(9,6),
    -- Dane użytkownika
    height DECIMAL(5,2),
    program_start_date DATE DEFAULT '2026-04-26',
    disciplined_streak INTEGER DEFAULT 0,
    total_disciplined_days INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================
-- SEKCJA 9: RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.workout_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_habits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_photos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oura_daily_summary       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_nutrition          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_food_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_goals               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_wins               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_fundament           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stayfree_usage           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_identity        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_correlations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_goal_alignment  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_signatures      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_knowledge       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_temporal_links  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_stream          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings            ENABLE ROW LEVEL SECURITY;

-- Polityki (jeden wzorzec dla wszystkich)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workout_sessions' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.workout_sessions FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exercise_logs' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.exercise_logs FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_habits' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.daily_habits FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='body_metrics' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.body_metrics FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='progress_photos' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.progress_photos FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='oura_daily_summary' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.oura_daily_summary FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_nutrition' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.daily_nutrition FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_food_entries' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.daily_food_entries FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='life_goals' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.life_goals FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_wins' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.daily_wins FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='weekly_reviews' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.weekly_reviews FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_fundament' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.user_fundament FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='location_history' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.location_history FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stayfree_usage' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.stayfree_usage FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vanguard_daily_aggregates' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.vanguard_daily_aggregates FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vanguard_identity' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.vanguard_identity FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vanguard_correlations' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.vanguard_correlations FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vanguard_goal_alignment' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.vanguard_goal_alignment FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vanguard_signatures' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.vanguard_signatures FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vanguard_knowledge' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.vanguard_knowledge FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vanguard_temporal_links' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.vanguard_temporal_links FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='vanguard_stream' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.vanguard_stream FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_chat_messages' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.ai_chat_messages FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_settings' AND policyname='own_data') THEN
    CREATE POLICY own_data ON public.user_settings FOR ALL USING (auth.uid() = user_id); END IF;
END $$;

-- ============================================================
-- SEKCJA 10: INDEKSY
-- ============================================================

-- Treningi
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date     ON public.workout_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_session_id       ON public.exercise_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_exercise    ON public.exercise_logs(user_id, exercise_name);

-- Behawior
CREATE INDEX IF NOT EXISTS idx_daily_wins_user_date           ON public.daily_wins(user_id, date);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_week       ON public.weekly_reviews(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_food_entries_user_date         ON public.daily_food_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_user_date      ON public.daily_nutrition(user_id, date);

-- Oura
CREATE INDEX IF NOT EXISTS idx_oura_user_date_desc            ON public.oura_daily_summary(user_id, date DESC);

-- Lokalizacja
CREATE INDEX IF NOT EXISTS idx_location_user_date             ON public.location_history(user_id, created_at);

-- StayFree
CREATE INDEX IF NOT EXISTS idx_stayfree_user_date             ON public.stayfree_usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_stayfree_app_name              ON public.stayfree_usage(app_name);

-- Vanguard
CREATE INDEX IF NOT EXISTS idx_vanguard_aggregates_user_date  ON public.vanguard_daily_aggregates(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_vanguard_temporal_links        ON public.vanguard_temporal_links(user_id, source_date);
CREATE INDEX IF NOT EXISTS idx_vanguard_knowledge_user        ON public.vanguard_knowledge(user_id);
CREATE INDEX IF NOT EXISTS idx_vanguard_signatures_user       ON public.vanguard_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_vanguard_signatures_outcome    ON public.vanguard_signatures(outcome_state);

-- HNSW (Semantic Search — wymaga pgvector)
CREATE INDEX IF NOT EXISTS idx_vanguard_knowledge_embedding   ON public.vanguard_knowledge    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_daily_wins_embedding           ON public.daily_wins            USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_embedding       ON public.weekly_reviews        USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_user_fundament_embedding       ON public.user_fundament        USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_embedding     ON public.workout_sessions      USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_vanguard_stream_embedding      ON public.vanguard_stream       USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- SEKCJA 11: FUNKCJE I TRIGGERY
-- ============================================================

-- Streak dyscypliny (szybszy niż pętla w JS)
CREATE OR REPLACE FUNCTION calculate_disciplined_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_streak INTEGER := 0;
    v_record RECORD;
    v_today DATE := CURRENT_DATE;
BEGIN
    FOR v_record IN
        SELECT date, is_disciplined
        FROM public.oura_daily_summary
        WHERE user_id = p_user_id
        ORDER BY date DESC
    LOOP
        IF v_record.is_disciplined THEN
            v_streak := v_streak + 1;
        ELSIF v_record.date = v_today THEN
            CONTINUE;
        ELSE
            EXIT;
        END IF;
    END LOOP;
    RETURN v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update streaku po syncronizacji Oura
CREATE OR REPLACE FUNCTION update_user_streak_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_settings
    SET
        disciplined_streak    = calculate_disciplined_streak(NEW.user_id),
        total_disciplined_days = (SELECT count(*) FROM public.oura_daily_summary WHERE user_id = NEW.user_id AND is_disciplined = TRUE)
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_oura_sync_update_streak ON public.oura_daily_summary;
CREATE TRIGGER on_oura_sync_update_streak
    AFTER INSERT OR UPDATE ON public.oura_daily_summary
    FOR EACH ROW EXECUTE FUNCTION update_user_streak_stats();

-- Atomowy zapis treningu (zabezpieczenie przed niekompletnymi sesjami)
CREATE OR REPLACE FUNCTION save_workout_atomic(
    p_user_id UUID, p_day_key VARCHAR, p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ, p_notes TEXT, p_msp_passed BOOLEAN, p_logs JSONB
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
    v_log JSONB;
BEGIN
    INSERT INTO public.workout_sessions (user_id, workout_day, start_time, end_time, session_notes, msp_passed)
    VALUES (p_user_id, p_day_key, p_start_time, p_end_time, p_notes, p_msp_passed)
    RETURNING id INTO v_session_id;

    FOR v_log IN SELECT * FROM jsonb_array_elements(p_logs)
    LOOP
        INSERT INTO public.exercise_logs (session_id, user_id, exercise_name, set_number, reps, weight, rpe)
        VALUES (
            v_session_id, p_user_id,
            v_log->>'exercise_name',
            (v_log->>'set_number')::INTEGER,
            (v_log->>'reps')::INTEGER,
            (v_log->>'weight')::DECIMAL,
            (v_log->>'rpe')::DECIMAL
        );
    END LOOP;
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SEKCJA 12: HYBRID RETRIEVAL (Semantic Search)
-- Wersja finalna 6.4 — przeszukuje 6 tabel
-- ============================================================

DROP FUNCTION IF EXISTS public.match_vanguard_content(vector, float, int, uuid);

CREATE OR REPLACE FUNCTION public.match_vanguard_content(
    query_embedding  vector(1536),
    match_threshold  float,
    match_count      int,
    user_id_param    uuid
)
RETURNS TABLE (
    id             uuid,
    table_name     text,
    content        text,
    source_date    date,
    similarity     float,
    importance_score int,
    hybrid_score   float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH all_content AS (
        SELECT vk.id, 'vanguard_knowledge'::text,
               vk.content, vk.created_at::date, vk.importance_score,
               (vk.embedding <=> query_embedding) as distance
        FROM vanguard_knowledge vk
        WHERE vk.user_id = user_id_param AND vk.embedding IS NOT NULL

        UNION ALL

        SELECT dw.id, 'daily_wins'::text,
               COALESCE(dw.journal_entry,'') || ' ' || COALESCE(dw.gratitude_entry,''),
               dw.date, 5,
               (dw.embedding <=> query_embedding)
        FROM daily_wins dw
        WHERE dw.user_id = user_id_param AND dw.embedding IS NOT NULL

        UNION ALL

        SELECT wr.id, 'weekly_reviews'::text,
               COALESCE(wr.proud_of,'') || ' ' || COALESCE(wr.sabotage,''),
               wr.week_start, 7,
               (wr.embedding <=> query_embedding)
        FROM weekly_reviews wr
        WHERE wr.user_id = user_id_param AND wr.embedding IS NOT NULL

        UNION ALL

        SELECT ws.id, 'workout_sessions'::text,
               ws.session_notes, ws.date, 4,
               (ws.embedding <=> query_embedding)
        FROM workout_sessions ws
        WHERE ws.user_id = user_id_param AND ws.embedding IS NOT NULL

        UNION ALL

        SELECT uf.user_id, 'user_fundament'::text,
               COALESCE(uf.identity,'') || ' ' || COALESCE(uf.philosophy,''),
               uf.updated_at::date, 10,
               (uf.embedding <=> query_embedding)
        FROM user_fundament uf
        WHERE uf.user_id = user_id_param AND uf.embedding IS NOT NULL

        UNION ALL

        SELECT vs.id, 'vanguard_stream'::text,
               vs.content, vs.created_at::date, 6,
               (vs.embedding <=> query_embedding)
        FROM vanguard_stream vs
        WHERE vs.user_id = user_id_param AND vs.embedding IS NOT NULL
    ),
    scored AS (
        SELECT *, (1 - distance) as similarity,
               exp(-0.005 * (current_date - source_date)) as recency_weight
        FROM all_content
        WHERE (1 - distance) > match_threshold
    )
    SELECT id, table_name, content, source_date, similarity, importance_score,
           ((similarity * 0.5) + ((importance_score / 10.0) * 0.3) + (recency_weight * 0.2))::float
    FROM scored
    ORDER BY 7 DESC
    LIMIT match_count;
END;
$$;

-- ============================================================
-- KOMENTARZE BEZPIECZEŃSTWA
-- ============================================================
COMMENT ON COLUMN public.user_settings.yazio_password IS
    'UWAGA: Przechowywane w plaintext. Przenieś do Vault przy skalowaniu.';
