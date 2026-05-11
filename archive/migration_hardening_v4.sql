-- MIGRACJA: HARDENING & PERFORMANCE (Phase 4)
-- Zapobiega degradacji wydajności i poprawia bezpieczeństwo logiczne.

-- 1. INDEKSY DLA WYDAJNOŚCI (Wyeliminowanie skanów całych tabel)
CREATE INDEX IF NOT EXISTS idx_exercise_logs_session_id ON public.exercise_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_exercise ON public.exercise_logs(user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON public.workout_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_screen_time_user_date ON public.screen_time_details(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_user_date ON public.daily_nutrition(user_id, date);

-- 2. FUNKCJA SQL DO OBLICZANIA STREAKU (Zamiast pętli w JS)
-- Jest to o rzędy wielkości szybsze i oszczędza transfer danych.
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
            -- Jeśli dzisiaj jeszcze nie ma danych, nie przerywaj streaku
            CONTINUE;
        ELSE
            -- Przerwanie streaku
            EXIT;
        END IF;
    END LOOP;
    RETURN v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. AUTOMATYZACJA AKTUALIZACJI USTAWIEŃ (Trigger)
-- Dzięki temu sync-oura nie musi ręcznie aktualizować streaku.
CREATE OR REPLACE FUNCTION update_user_streak_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_settings
    SET 
        disciplined_streak = calculate_disciplined_streak(NEW.user_id),
        total_disciplined_days = (SELECT count(*) FROM public.oura_daily_summary WHERE user_id = NEW.user_id AND is_disciplined = TRUE)
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_oura_sync_update_streak ON public.oura_daily_summary;
CREATE TRIGGER on_oura_sync_update_streak
AFTER INSERT OR UPDATE ON public.oura_daily_summary
FOR EACH ROW EXECUTE FUNCTION update_user_streak_stats();

-- 5. INTEGRALNOŚĆ DANYCH (Yazio)
-- Dodanie unikalnego klucza, aby umożliwić bezpieczny UPSERT bez usuwania danych.
ALTER TABLE public.daily_food_entries 
ADD CONSTRAINT unique_user_date_name_meal 
UNIQUE (user_id, date, name, meal_type);

-- 6. ATOMOWY ZAPIS TRENINGU (Zapobiega niekompletnym sesjom przy braku sieci)
CREATE OR REPLACE FUNCTION save_workout_atomic(
    p_user_id UUID,
    p_day_key VARCHAR,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_notes TEXT,
    p_msp_passed BOOLEAN,
    p_logs JSONB
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
    v_log JSONB;
BEGIN
    -- 1. Wstawienie sesji
    INSERT INTO public.workout_sessions (user_id, workout_day, start_time, end_time, session_notes, msp_passed)
    VALUES (p_user_id, p_day_key, p_start_time, p_end_time, p_notes, p_msp_passed)
    RETURNING id INTO v_session_id;

    -- 2. Wstawienie logów z tablicy JSON
    FOR v_log IN SELECT * FROM jsonb_array_elements(p_logs)
    LOOP
        INSERT INTO public.exercise_logs (session_id, user_id, exercise_name, set_number, reps, weight, rpe)
        VALUES (
            v_session_id, 
            p_user_id, 
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

-- 7. DYNAMICZNY START PROGRAMU
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS program_start_date DATE DEFAULT '2026-04-26';

COMMENT ON COLUMN public.user_settings.yazio_password IS 'WARNING: Przechowywane w plaintext. Przenieś do Vault w produkcji.';
