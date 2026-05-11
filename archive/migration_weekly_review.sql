-- MIGRACJA DLA TYGODNIOWEGO PRZEGLĄDU (WEEKLY REVIEW)

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    proud_of TEXT,
    sabotage TEXT,
    do_differently TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(user_id, week_start)
);

ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own weekly reviews" ON public.weekly_reviews
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_week ON public.weekly_reviews(user_id, week_start);
