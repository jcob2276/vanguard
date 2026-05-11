-- MIGRATION: V6.2 - AUTOMATION & SETUP
-- Konfiguracja automatyzacji i przypomnienie o sekretach

-- 1. Automatyzacja: save-daily-aggregate (codziennie o 00:10)
-- Wymaga włączonego rozszerzenia pg_cron w Supabase (Dashboard -> Database -> Extensions)
-- UWAGA: Zastąp <PROJECT_REF> swoim identyfikatorem projektu Supabase

/*
SELECT cron.schedule(
    'vanguard-daily-aggregate',
    '10 0 * * *',
    $$
    SELECT
      net.http_post(
        url:='https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/save-daily-aggregate',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body:='{"userId": "165ae341-670c-46ce-82dc-434c4dbfcdfd"}'::jsonb
      ) as request_id;
    $$
);
*/

-- 2. Lista wymaganych sekretów (Supabase Edge Functions)
-- Uruchom te komendy w terminalu:
/*
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set TELEGRAM_BOT_TOKEN=...
npx supabase secrets set TELEGRAM_CHAT_ID=...
npx supabase secrets set VANGUARD_USER_ID=...
*/

-- 3. Indeksy dla wydajności semantic search
CREATE INDEX IF NOT EXISTS idx_vanguard_knowledge_embedding ON public.vanguard_knowledge USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_daily_wins_embedding ON public.daily_wins USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_embedding ON public.weekly_reviews USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_user_fundament_embedding ON public.user_fundament USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_embedding ON public.workout_sessions USING hnsw (embedding vector_cosine_ops);
