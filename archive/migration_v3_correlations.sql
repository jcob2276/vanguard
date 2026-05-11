-- MIGRACJA V3: KORELACJE I FEEDBACK
-- Ta tabela przechowuje statystyczne "prawa fizyki" Twojego zachowania.

CREATE TABLE IF NOT EXISTS vanguard_correlations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    signal_name text NOT NULL,
    lag_days integer NOT NULL,
    r_value float NOT NULL, -- Współczynnik Pearsona (-1 do 1)
    sample_size integer NOT NULL,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, signal_name, lag_days)
);

-- Tabela pod Goal Alignment Engine (nadchodzący upgrade)
CREATE TABLE IF NOT EXISTS vanguard_goal_alignment (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    date date NOT NULL,
    alignment_score float NOT NULL, -- 0-100
    drift_score float NOT NULL,
    wasted_time_min integer DEFAULT 0,
    primary_leak text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, date)
);
