-- MIGRACJA V4: FINAL DATA PIPE FIX
-- 1. Naprawa Skarbca Tożsamości
ALTER TABLE public.life_goals ADD COLUMN IF NOT EXISTS vault_content TEXT DEFAULT '';

-- 2. Naprawa Chatu AI (Tabela dla MentorChat)
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' | 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. RLS dla Chatu
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_chat_messages' AND policyname = 'Users can manage their own chat messages'
    ) THEN
        CREATE POLICY "Users can manage their own chat messages" ON public.ai_chat_messages
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Indeksy dla wydajności konwersacji
CREATE INDEX IF NOT EXISTS idx_ai_chat_user_date ON public.ai_chat_messages(user_id, created_at ASC);
