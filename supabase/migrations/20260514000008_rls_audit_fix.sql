-- ============================================================
-- VANGUARD OS — RLS SECURITY AUDIT & FIX
-- Wersja: 1.0 | Data: 2026-05-14
-- Priorytet: vanguard_footprint, vanguard_oracle_runs, vanguard_raw_events
-- ============================================================

-- 1. VANGUARD_FOOTPRINT
ALTER TABLE IF EXISTS public.vanguard_footprint ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_footprint' AND policyname = 'Users own footprint') THEN
        CREATE POLICY "Users own footprint" ON public.vanguard_footprint FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- 2. VANGUARD_ORACLE_RUNS
ALTER TABLE IF EXISTS public.vanguard_oracle_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_oracle_runs' AND policyname = 'Users own oracle runs') THEN
        CREATE POLICY "Users own oracle runs" ON public.vanguard_oracle_runs FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- 3. VANGUARD_RAW_EVENTS
ALTER TABLE IF EXISTS public.vanguard_raw_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vanguard_raw_events' AND policyname = 'Users own raw events') THEN
        CREATE POLICY "Users own raw events" ON public.vanguard_raw_events FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- DODATKOWO: SPRAWDZENIE INNYCH TABEL RDZENNYCH
ALTER TABLE IF EXISTS public.vanguard_daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vanguard_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vanguard_stream ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vanguard_intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vanguard_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vanguard_temporal_links ENABLE ROW LEVEL SECURITY;
