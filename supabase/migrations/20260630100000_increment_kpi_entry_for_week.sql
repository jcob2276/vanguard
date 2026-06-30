-- Atomic weekly KPI increment, used to roll up daily_wins.task_N_target_value
-- into kpi_entries when a linked daily task is marked done/undone.
create or replace function public.increment_kpi_entry_for_week(
  p_kpi_id uuid,
  p_week_start date,
  p_delta numeric
) returns void
language plpgsql
security invoker
as $$
begin
  insert into public.kpi_entries (user_id, kpi_id, week_start, value)
  values (auth.uid(), p_kpi_id, p_week_start, p_delta)
  on conflict (kpi_id, week_start)
  do update set value = coalesce(kpi_entries.value, 0) + excluded.value;
end;
$$;
