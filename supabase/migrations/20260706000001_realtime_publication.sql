-- Włącz publikację realtime dla tabel Todo i Notatek (odbudowa Tamy 1)

BEGIN;

-- Publikacja supabase_realtime jest domyślnie tworzona przez platformę,
-- ale upewniamy się, że istnieje przed dodaniem tabel.
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.todo_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vanguard_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vanguard_stream;

COMMIT;
