-- Canonical SQL twin of getSprintInfo() in src/components/desktop/desktopUtils.ts.
-- Lets any date-anchored table (training_plan_workouts.planned_date, etc.) be related
-- to the personal sprint cycle (anchor 2026-03-01, 84-day/12-week sprints) without a
-- second hand-maintained copy of the math living only in app code.
-- MUST stay in sync with getSprintInfo() — if you change one, change both, and re-verify
-- parity for the test dates below (run via execute_sql, not part of automated CI).
create or replace function public.sprint_info_for_date(d date)
returns table (personal_year integer, sprint_number integer, week_in_sprint integer)
language sql
immutable
as $$
  with anchor_calc as (
    select case
      when d >= make_date(extract(year from d)::int, 3, 1)
        then make_date(extract(year from d)::int, 3, 1)
      else make_date(extract(year from d)::int - 1, 3, 1)
    end as anchor
  ),
  days_calc as (
    select anchor, (d - anchor) as days_since from anchor_calc
  ),
  weeks_calc as (
    select anchor, days_since, (days_since / 7) as weeks_since from days_calc
  )
  select
    extract(year from anchor)::int as personal_year,
    (weeks_since / 12) + 1 as sprint_number,
    (weeks_since % 12) + 1 as week_in_sprint
  from weeks_calc;
$$;
