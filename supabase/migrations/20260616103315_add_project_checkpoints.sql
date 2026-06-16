CREATE TABLE IF NOT EXISTS public.project_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dropped')),
  completed_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_checkpoints_select" ON public.project_checkpoints;
DROP POLICY IF EXISTS "project_checkpoints_insert" ON public.project_checkpoints;
DROP POLICY IF EXISTS "project_checkpoints_update" ON public.project_checkpoints;
DROP POLICY IF EXISTS "project_checkpoints_delete" ON public.project_checkpoints;

CREATE POLICY "project_checkpoints_select" ON public.project_checkpoints
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "project_checkpoints_insert" ON public.project_checkpoints
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "project_checkpoints_update" ON public.project_checkpoints
  FOR UPDATE USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "project_checkpoints_delete" ON public.project_checkpoints
  FOR DELETE USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_project_checkpoints_project_status
  ON public.project_checkpoints (project_id, status, due_date, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_checkpoints_user_due
  ON public.project_checkpoints (user_id, due_date) WHERE due_date IS NOT NULL AND status = 'open';

DROP TRIGGER IF EXISTS trg_project_checkpoints_updated_at ON public.project_checkpoints;
CREATE TRIGGER trg_project_checkpoints_updated_at
  BEFORE UPDATE ON public.project_checkpoints
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_checkpoints TO authenticated;
