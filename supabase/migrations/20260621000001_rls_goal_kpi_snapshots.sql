ALTER TABLE public.goal_kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON public.goal_kpi_snapshots FOR ALL USING (auth.uid() = user_id);
