-- MIGRACJA DLA SEKCJI KIERUNEK (POWER LIST)

-- 1. TABELA CELÓW ŻYCIOWYCH
CREATE TABLE public.life_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_cialo TEXT DEFAULT 'Zdefiniuj cel dla ciała',
    goal_duch TEXT DEFAULT 'Zdefiniuj cel dla ducha',
    goal_konto TEXT DEFAULT 'Zdefiniuj cel dla konta',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(user_id)
);

-- 2. TABELA DZIENNYCH ZWYCIĘSTW
CREATE TABLE public.daily_wins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    
    task_1 TEXT, category_1 TEXT, done_1 BOOLEAN DEFAULT FALSE,
    task_2 TEXT, category_2 TEXT, done_2 BOOLEAN DEFAULT FALSE,
    task_3 TEXT, category_3 TEXT, done_3 BOOLEAN DEFAULT FALSE,
    task_4 TEXT, category_4 TEXT, done_4 BOOLEAN DEFAULT FALSE,
    task_5 TEXT, category_5 TEXT, done_5 BOOLEAN DEFAULT FALSE,
    
    result VARCHAR(1), -- 'Z' (Zwycięstwo), 'P' (Porażka)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(user_id, date)
);

-- 3. RLS
ALTER TABLE public.life_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own life goals" ON public.life_goals
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own daily wins" ON public.daily_wins
    FOR ALL USING (auth.uid() = user_id);

-- 4. INDEKSY
CREATE INDEX idx_daily_wins_user_date ON public.daily_wins(user_id, date);
