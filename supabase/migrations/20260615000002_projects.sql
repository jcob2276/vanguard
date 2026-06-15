CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text,
  deadline date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'done')),
  color text NOT NULL DEFAULT 'indigo',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.todo_sections
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_owner ON public.projects
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
