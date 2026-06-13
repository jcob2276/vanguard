-- Vanguard native To Do MVP.
-- Replaces the need for Todoist as an external task inbox. This is intentionally
-- separate from career_projects/career_moves and daily_wins.

CREATE TABLE IF NOT EXISTS public.todo_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.todo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.todo_sections(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'done', 'dropped')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  tags text[] NOT NULL DEFAULT '{}'::text[],
  due_date date,
  completed_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, section_id, title)
);

ALTER TABLE public.todo_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "todo_sections_select" ON public.todo_sections;
DROP POLICY IF EXISTS "todo_sections_insert" ON public.todo_sections;
DROP POLICY IF EXISTS "todo_sections_update" ON public.todo_sections;
CREATE POLICY "todo_sections_select" ON public.todo_sections FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "todo_sections_insert" ON public.todo_sections FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "todo_sections_update" ON public.todo_sections FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "todo_items_select" ON public.todo_items;
DROP POLICY IF EXISTS "todo_items_insert" ON public.todo_items;
DROP POLICY IF EXISTS "todo_items_update" ON public.todo_items;
CREATE POLICY "todo_items_select" ON public.todo_items FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "todo_items_insert" ON public.todo_items FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "todo_items_update" ON public.todo_items FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_todo_sections_user_order
  ON public.todo_sections (user_id, is_archived, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_todo_items_user_status
  ON public.todo_items (user_id, status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_todo_items_section_status
  ON public.todo_items (section_id, status, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_todo_items_due
  ON public.todo_items (user_id, due_date) WHERE due_date IS NOT NULL AND status = 'open';

DROP TRIGGER IF EXISTS trg_todo_sections_updated_at ON public.todo_sections;
CREATE TRIGGER trg_todo_sections_updated_at
  BEFORE UPDATE ON public.todo_sections
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_todo_items_updated_at ON public.todo_items;
CREATE TRIGGER trg_todo_items_updated_at
  BEFORE UPDATE ON public.todo_items
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.todo_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.todo_items TO authenticated;

-- Seed current Todoist backlog into Vanguard for the primary user.
DO $$
DECLARE
  v_user uuid := '165ae341-670c-46ce-82dc-434c4dbfcdfd';
BEGIN
  INSERT INTO public.todo_sections (user_id, name, sort_order) VALUES
    (v_user, 'Dom / sprawy fizyczne', 10),
    (v_user, 'Praca / pieniądze', 20),
    (v_user, 'Teraz / najbliższe 7 dni', 30),
    (v_user, 'Studia / egzaminy', 40),
    (v_user, 'Ciało / energia', 50),
    (v_user, 'Cyfrowe / admin', 60),
    (v_user, 'Kierunek / charakter', 70),
    (v_user, 'Kiedyś / wizje', 80)
  ON CONFLICT (user_id, name) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    is_archived = false;

  INSERT INTO public.todo_items (user_id, section_id, title, priority, tags, sort_order)
  SELECT v_user, s.id, x.title, x.priority, x.tags, x.sort_order
  FROM (
    VALUES
      ('Dom / sprawy fizyczne', 'Opona do mechanika - prawa tylna', 'normal', ARRAY['zakup']::text[], 10),
      ('Dom / sprawy fizyczne', 'Przywieźć rower od babci do domu', 'normal', ARRAY[]::text[], 20),
      ('Praca / pieniądze', 'Przejrzeć ostatnie wydatki', 'high', ARRAY['finanse']::text[], 10),
      ('Praca / pieniądze', 'Zrobić lepsze CV', 'high', ARRAY['projekt']::text[], 20),
      ('Praca / pieniądze', 'Zrobić portfolio', 'high', ARRAY['projekt']::text[], 30),
      ('Studia / egzaminy', 'Sprawko do Posiewały - sprawdzić i wysłać', 'high', ARRAY['egzamin']::text[], 10),
      ('Ciało / energia', 'Zrobić holistyczne badania', 'high', ARRAY['zdrowie']::text[], 10),
      ('Ciało / energia', 'Rozpisać trening pod maraton 4 października', 'high', ARRAY['zdrowie','projekt']::text[], 20),
      ('Cyfrowe / admin', 'Napisać do Kacpra ws. domeny', 'normal', ARRAY['telefon','projekt']::text[], 10),
      ('Cyfrowe / admin', 'Przejrzeć stare linki z Messengera', 'low', ARRAY['niska-dopamina']::text[], 20),
      ('Kiedyś / wizje', 'Spisać wizję: relacje, zdrowie, finanse, doświadczenia', 'normal', ARRAY['projekt']::text[], 10)
  ) AS x(section_name, title, priority, tags, sort_order)
  JOIN public.todo_sections s ON s.user_id = v_user AND s.name = x.section_name
  ON CONFLICT (user_id, section_id, title) DO UPDATE SET
    priority = EXCLUDED.priority,
    tags = EXCLUDED.tags,
    sort_order = EXCLUDED.sort_order,
    status = CASE WHEN public.todo_items.status = 'dropped' THEN 'open' ELSE public.todo_items.status END;
END $$;
