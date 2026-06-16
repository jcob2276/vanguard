-- Lista 200 Marzeń — bucket na marzenia/wizje, bez połączenia z task system
CREATE TABLE IF NOT EXISTS public.dreams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  category    text        NOT NULL DEFAULT 'inne'
                          CHECK (category IN ('finanse','ciało','relacje','doświadczenia','wolność','inne')),
  is_done     boolean     NOT NULL DEFAULT false,
  done_at     timestamptz,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dreams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dreams_select" ON public.dreams FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "dreams_insert" ON public.dreams FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "dreams_update" ON public.dreams FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "dreams_delete" ON public.dreams FOR DELETE USING ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dreams TO authenticated;

CREATE INDEX IF NOT EXISTS idx_dreams_user ON public.dreams (user_id, is_done, category, created_at);
