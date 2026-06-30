-- Consolidate KPI progress onto a single source of truth: kpi_entries (week_start-scoped).
-- goal_kpis.current_value and goal_kpi_snapshots were a parallel, disconnected tracking
-- system (manual edit in Projects tab) that never synced with kpi_entries (Weekly Review +
-- daily_wins rollup). Confirmed empty before drop (0 current_value set, 0 snapshots).

alter table public.goal_kpis drop column current_value;
drop table public.goal_kpi_snapshots;
