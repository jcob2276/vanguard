-- Link next sprint goal to continuing projects (structural, not just free text).
alter table sprint_goals
  add column if not exists focus_project_ids uuid[] default '{}'::uuid[];
