-- ============================================================
-- VANGUARD OS — SAVED LINKS / READ-IT-LATER INBOX
-- Cel: Przechowywanie zapisanych artykułów, filmów i linków z AI podsumowaniem
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vanguard_links (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url         text NOT NULL,
    title       text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    takeaways   text[] NOT NULL DEFAULT '{}', -- dokładnie 3 kluczowe wnioski
    category    text NOT NULL DEFAULT 'Inne', -- Kariera, Zdrowie, Technologia, Biznes, Inne
    domain      text NOT NULL DEFAULT '',     -- np. youtube.com, medium.com
    status      text NOT NULL DEFAULT 'unread', -- unread, read
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Włączenie RLS
ALTER TABLE public.vanguard_links ENABLE ROW LEVEL SECURITY;

-- Polityka dostępu dla właściciela
DROP POLICY IF EXISTS "Users manage own links" ON public.vanguard_links;
CREATE POLICY "Users manage own links"
    ON public.vanguard_links FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Indeksy dla szybkiego filtrowania i sortowania
CREATE INDEX IF NOT EXISTS idx_vanguard_links_user_status_created
    ON public.vanguard_links (user_id, status, created_at DESC);
