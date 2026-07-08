-- ============================================================
-- VANGUARD OS — DAY 4: PREDICTIONS & BRIER SCORE
-- ============================================================

-- 1. Table public.vanguard_predictions
CREATE TABLE IF NOT EXISTS public.vanguard_predictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    prediction_date date NOT NULL,
    predicted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    prediction_type text NOT NULL CHECK (prediction_type IN ('metric', 'pattern', 'custom')),
    metric text NOT NULL,
    predicted_value double precision NOT NULL,
    predicted_interval_low double precision,
    predicted_interval_high double precision,
    actual_value double precision,
    error_value double precision,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_user_date_type_metric UNIQUE (user_id, prediction_date, prediction_type, metric)
);

-- 2. Enable RLS
ALTER TABLE public.vanguard_predictions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY users_own_predictions ON public.vanguard_predictions
    FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY service_role_predictions ON public.vanguard_predictions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Grant permissions
GRANT ALL ON TABLE public.vanguard_predictions TO service_role;
GRANT SELECT ON TABLE public.vanguard_predictions TO authenticated;
