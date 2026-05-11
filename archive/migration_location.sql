-- Tabela na historię lokalizacji
CREATE TABLE IF NOT EXISTS location_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    place_name TEXT, -- Np. "Siłownia", "Dom", "Praca"
    is_manual BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, created_at)
);

-- Index dla szybkiego wyszukiwania po dacie i użytkowniku
CREATE INDEX IF NOT EXISTS idx_location_user_date ON location_history(user_id, created_at);

-- RLS
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own location history"
    ON location_history FOR ALL
    USING (auth.uid() = user_id);
