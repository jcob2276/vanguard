-- ============================================================
-- VANGUARD OS — GOOGLE KEEP CLONE STORAGE
-- Cel: Własne notatki w stylu Google Keep przechowywane u siebie
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vanguard_notes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       text NOT NULL DEFAULT '',
    content     text NOT NULL DEFAULT '',
    color       text NOT NULL DEFAULT 'default', -- default, red, blue, green, yellow, purple, etc.
    is_pinned   boolean NOT NULL DEFAULT false,
    tags        text[] NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Włączenie zabezpieczeń RLS
ALTER TABLE public.vanguard_notes ENABLE ROW LEVEL SECURITY;

-- Polityka dostępu dla zalogowanego użytkownika
DROP POLICY IF EXISTS "Users manage own notes" ON public.vanguard_notes;
CREATE POLICY "Users manage own notes"
    ON public.vanguard_notes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Indeks dla szybkiego wyszukiwania
CREATE INDEX IF NOT EXISTS idx_vanguard_notes_user_pinned 
    ON public.vanguard_notes (user_id, is_pinned DESC, created_at DESC);
