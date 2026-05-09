-- MIGRACJA DLA INTEGRACJI STAYFREE

CREATE TABLE public.stayfree_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    app_name TEXT NOT NULL,
    device_name TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    unlocks INTEGER NOT NULL,
    launches INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(user_id, date, app_name, device_name)
);

-- RLS
ALTER TABLE public.stayfree_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own stayfree data" ON public.stayfree_usage
    FOR ALL USING (auth.uid() = user_id);

-- Indeksy dla wydajności
CREATE INDEX idx_stayfree_user_date ON public.stayfree_usage(user_id, date);
CREATE INDEX idx_stayfree_app_name ON public.stayfree_usage(app_name);
