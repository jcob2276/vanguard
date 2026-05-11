-- MIGRACJA DLA SZCZEGÓŁOWEGO JEDZENIA Z YAZIO

-- 1. TABELA SZCZEGÓŁOWYCH WPISÓW JEDZENIA
CREATE TABLE public.daily_food_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    name TEXT NOT NULL,
    calories INTEGER,
    protein DECIMAL(5,2),
    meal_type TEXT, -- 'breakfast', 'lunch', 'dinner', 'snack'
    amount TEXT, -- np. "100g", "1 sztuka"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. RLS
ALTER TABLE public.daily_food_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own food entries" ON public.daily_food_entries
    FOR ALL USING (auth.uid() = user_id);

-- 3. INDEKS DLA SZYBSZEGO WYSZUKIWANIA
CREATE INDEX idx_food_entries_user_date ON public.daily_food_entries(user_id, date);
