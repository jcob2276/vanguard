
CREATE TABLE public.pattern_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    pattern_id uuid REFERENCES public.vanguard_behavioral_patterns(id) ON DELETE CASCADE,
    occurred_on date NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(pattern_id, occurred_on)
);

ALTER TABLE public.pattern_events ENABLE ROW LEVEL SECURITY;
