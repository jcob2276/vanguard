-- MIGRATION: V4 - SIGNATURE MEMORY
-- Przejście z narracji na deterministyczne wzorce sygnałowe

CREATE TABLE IF NOT EXISTS public.vanguard_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    name TEXT, -- np. "PRE-DRIFT-07", "FLOW-STATE-ALPHA"
    signature_sequence JSONB, -- [ "switching_high", "idle_long", "task_stuck" ]
    biometric_context JSONB, -- { "hrv_delta": -10, "sleep_score": 65 }
    outcome_state TEXT, -- "DRIFT", "LOCKED_IN", "COLLAPSE", "RECOVERY"
    lead_time_min INTEGER, -- Czas od sekwencji do skutku
    created_at TIMESTAMPTZ DEFAULT now(),
    occurrence_count INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'
);

-- Index dla szybkiego wyszukiwania podobnych wzorców
CREATE INDEX IF NOT EXISTS idx_vanguard_signatures_user ON public.vanguard_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_vanguard_signatures_outcome ON public.vanguard_signatures(outcome_state);
