-- MIGRACJA DLA INTEGRACJI YAZIO

-- 1. TABELA ŻYWIENIA
CREATE TABLE public.daily_nutrition (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    calories INTEGER,
    protein DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(user_id, date)
);

-- 2. AKTUALIZACJA USTAWIEŃ (Dla Yazio)
ALTER TABLE public.user_settings 
ADD COLUMN yazio_username TEXT,
ADD COLUMN yazio_password TEXT,
ADD COLUMN yazio_token TEXT;

-- 3. RLS
ALTER TABLE public.daily_nutrition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own nutrition data" ON public.daily_nutrition
    FOR ALL USING (auth.uid() = user_id);

-- 4. WPISANIE TWOICH DANYCH (Uzupełnij ręcznie w Supabase)
-- UPDATE public.user_settings 
-- SET 
--   yazio_username = 'TWOJ_EMAIL',
--   yazio_password = 'TWOJE_HASLO'
-- WHERE user_id = 'TWOJE_UUID';

-- 5. CRON JOB (Uruchom w SQL Editor - co noc o 00:05)
-- Pamiętaj o podmieniu YOUR_PROJECT_REF i YOUR_SERVICE_ROLE_KEY
/*
select
  cron.schedule(
    'daily-yazio-sync',
    '5 0 * * *',
    $$
    select
      net.http_post(
        url:='https://YOUR_PROJECT_REF.functions.supabase.co/sync-yazio',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body:='{"userId": "TWOJE_UUID"}'::jsonb
      ) as request_id;
    $$
  );
*/
