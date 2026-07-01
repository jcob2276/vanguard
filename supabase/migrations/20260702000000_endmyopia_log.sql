-- Migration: Create endmyopia_measurements table

CREATE TYPE endmyopia_eye_enum AS ENUM ('left', 'right', 'both');

CREATE TABLE IF NOT EXISTS public.endmyopia_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    eye_measured endmyopia_eye_enum NOT NULL,
    blur_distance_cm NUMERIC(5, 2) NOT NULL,
    diopters NUMERIC(5, 2) NOT NULL,
    lighting_condition TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela statystyk dziennych
CREATE TABLE IF NOT EXISTS public.endmyopia_daily_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    active_focus_minutes INTEGER DEFAULT 0,
    screen_time_hours NUMERIC(4, 2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.endmyopia_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endmyopia_daily_logs ENABLE ROW LEVEL SECURITY;

-- Allow the authenticated user (service role or authenticated users depending on Vanguard setup)
CREATE POLICY "Allow full access to authenticated users on endmyopia_measurements"
ON public.endmyopia_measurements
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow full access to service_role on endmyopia_measurements"
ON public.endmyopia_measurements
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow full access to authenticated users on endmyopia_daily_logs"
ON public.endmyopia_daily_logs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow full access to service_role on endmyopia_daily_logs"
ON public.endmyopia_daily_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Index for querying by date
CREATE INDEX IF NOT EXISTS idx_endmyopia_measured_at ON public.endmyopia_measurements (measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_endmyopia_daily_date ON public.endmyopia_daily_logs (date DESC);
