-- SCHEMAT BAZY DANYCH DLA KUBA WORKOUT APP
-- Skopiuj ten kod i wklej w edytorze SQL w Supabase, a następnie kliknij "RUN".

-- 1. TABELA LOGÓW TRENINGOWYCH (Sesje)
CREATE TABLE public.workout_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workout_day VARCHAR(10) NOT NULL, -- 'A', 'B', 'C', 'D'
    date DATE DEFAULT CURRENT_DATE,
    duration_minutes INTEGER,
    session_notes TEXT,
    msp_passed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. TABELA LOGÓW SERII (Pojedyncze ćwiczenia)
CREATE TABLE public.exercise_logs (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. TABELA NAWYKÓW (Korekta postawy)
CREATE TABLE public.daily_habits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    couch_stretch BOOLEAN DEFAULT FALSE,
    chin_tucks BOOLEAN DEFAULT FALSE,
    glute_bridge BOOLEAN DEFAULT FALSE,
    child_pose BOOLEAN DEFAULT FALSE,
    bar_hang BOOLEAN DEFAULT FALSE,
    protein_170g BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(user_id, date)
);

-- WŁĄCZENIE RLS (Row Level Security) DLA BEZPIECZEŃSTWA
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_habits ENABLE ROW LEVEL SECURITY;

-- POLITYKI (Tylko zalogowany użytkownik widzi i edytuje SWOJE dane)
CREATE POLICY "Users can manage their own sessions" ON public.workout_sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own exercise logs" ON public.exercise_logs
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own habits" ON public.daily_habits
    FOR ALL USING (auth.uid() = user_id);
-- 4. TABELA POMIARÓW CIAŁA (Statystyki)
CREATE TABLE public.body_metrics (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(user_id, date)
);

-- WŁĄCZENIE RLS DLA NOWEJ TABELI
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

-- POLITYKI DLA NOWEJ TABELI
CREATE POLICY "Users can manage their own body metrics" ON public.body_metrics
    FOR ALL USING (auth.uid() = user_id);
-- 5. TABELA ZDJĘĆ SYLWETKI (Transformacja)
CREATE TABLE public.progress_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- WŁĄCZENIE RLS DLA NOWEJ TABELI
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

-- POLITYKI DLA NOWEJ TABELI
CREATE POLICY "Users can manage their own photos" ON public.progress_photos
    FOR ALL USING (auth.uid() = user_id);

-- 6. TABELA PODSUMOWAŃ OURA
CREATE TABLE public.oura_daily_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    readiness_score INTEGER,
    total_sleep_hours DECIMAL(4,2),
    steps INTEGER,
    bedtime_timestamp TIMESTAMP WITH TIME ZONE,
    is_disciplined BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(user_id, date)
);

-- 7. TABELA USTAWIEŃ UŻYTKOWNIKA (Tokeny itp.)
CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    oura_token TEXT,
    height DECIMAL(5,2),
    disciplined_streak INTEGER DEFAULT 0,
    total_disciplined_days INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- WŁĄCZENIE RLS
ALTER TABLE public.oura_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- POLITYKI
CREATE POLICY "Users can manage their own Oura data" ON public.oura_daily_summary
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own settings" ON public.user_settings
    FOR ALL USING (auth.uid() = user_id);


-- 8. HARMONOGRAMY (CRON) - Uruchom w SQL Editor
/*
-- Wymaga rozszerzenia pg_cron w Supabase
-- Co niedziel� o 20:00 (UTC)
select
  cron.schedule(
    'weekly-sunday-report',
    '0 20 * * 0',
    \$\$
    select
      net.http_post(
        url:='https://YOUR_PROJECT_REF.functions.supabase.co/weekly-report',
        headers:='{\"Content-Type\": \"application/json\", \"Authorization\": \"Bearer YOUR_SERVICE_ROLE_KEY\"}'::jsonb
      ) as request_id;
    \$\$
  );
*/
