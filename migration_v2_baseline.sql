-- VANGUARD 2.0: WARM STORAGE + IDENTITY LAYER
-- Wklej w Supabase SQL Editor i uruchom

-- TABLE 1: Daily Behavioral Snapshot (WARM STORAGE)
-- Tu system zapisuje dzienny snapshot - bez tych danych baseline nie istnieje
CREATE TABLE IF NOT EXISTS public.vanguard_daily_aggregates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL,

    -- Execution Layer
    execution_score float,        -- 0.0-1.0 (tasks done / 5)
    identity_score integer,       -- 0-100 composite daily score
    power_list_result text,       -- 'Z' | 'P' | null

    -- Biological Layer (from Oura)
    readiness_score float,
    sleep_hours float,
    hrv_avg float,
    rhr_avg float,
    temp_deviation float,

    -- Digital Layer (from StayFree)
    screen_time_min float,        -- total screen time in minutes
    dopamine_load_index float,    -- (social_sec / total_sec) * overlap * fragmentation
    fragmentation_index float,    -- unlocks per hour of real active time

    -- State
    final_state text,             -- computed state for this day
    state_confidence float,       -- 0.0-1.0

    created_at timestamp with time zone DEFAULT timezone('utc', now()),
    UNIQUE(user_id, date)
);

-- TABLE 2: Identity Baseline (Memory Layer)
-- Przechowuje długoterminowe wzorce behawioralne (np. z Google Takeout)
CREATE TABLE IF NOT EXISTS public.vanguard_identity (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    behavioral_baseline jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc', now())
);

-- RLS
ALTER TABLE public.vanguard_daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own aggregates"
    ON public.vanguard_daily_aggregates FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own identity"
    ON public.vanguard_identity FOR ALL USING (auth.uid() = user_id);

-- Indices (krytyczne dla szybkiego liczenia rolling averages)
CREATE INDEX IF NOT EXISTS idx_vanguard_aggregates_user_date
    ON public.vanguard_daily_aggregates(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_vanguard_aggregates_date_range
    ON public.vanguard_daily_aggregates(user_id, date)
    WHERE sleep_hours IS NOT NULL;
