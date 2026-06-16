-- Vision Board: afirmacje, obrazy, słowa kluczowe
CREATE TABLE IF NOT EXISTS public.vision_board_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL DEFAULT 'affirmation'
                          CHECK (type IN ('affirmation', 'image', 'word')),
  content     text        NOT NULL,
  color       text        NOT NULL DEFAULT 'indigo',
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vision_board_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vbi_select" ON public.vision_board_items FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "vbi_insert" ON public.vision_board_items FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "vbi_update" ON public.vision_board_items FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "vbi_delete" ON public.vision_board_items FOR DELETE USING ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vision_board_items TO authenticated;

CREATE INDEX IF NOT EXISTS idx_vbi_user ON public.vision_board_items (user_id, sort_order, created_at);
