-- Migration: Create vanguard_world_state table for dashboard caching

CREATE TABLE IF NOT EXISTS public.vanguard_world_state (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    state_json jsonb NOT NULL,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, date)
);

-- RLS
ALTER TABLE public.vanguard_world_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own world state" ON public.vanguard_world_state
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass world state" ON public.vanguard_world_state
    FOR ALL USING (true);

-- Index for date queries
CREATE INDEX IF NOT EXISTS idx_vanguard_world_state_date ON public.vanguard_world_state(user_id, date DESC);
