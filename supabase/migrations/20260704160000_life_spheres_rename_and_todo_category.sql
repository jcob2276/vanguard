-- Rename the 5 ad-hoc calendar/budget categories (work/health/personal/sport/study)
-- to the 6 canonical "life spheres" (praca/cialo_trening/duch_refleksja/finanse/
-- relacje_rodzina/odpoczynek_regeneracja). Finanse and odpoczynek_regeneracja are
-- new spheres with no historical data to migrate.
--
-- Mapping: work -> praca, personal -> relacje_rodzina, study -> duch_refleksja,
-- health + sport -> cialo_trening (merged; both were "the body" already).
--
-- vanguard_calendar.category has no uniqueness constraint, so a plain CASE update
-- is safe. vanguard_time_budgets.category is UNIQUE(user_id, category), so merging
-- health+sport must fold one row into the other before renaming, or the rename
-- would violate the constraint for any user who had budgeted both.

-- 1. vanguard_calendar: straightforward value rename (google_sync and any other
--    category values are left untouched by design).
update public.vanguard_calendar
set category = case category
  when 'work' then 'praca'
  when 'personal' then 'relacje_rodzina'
  when 'study' then 'duch_refleksja'
  when 'health' then 'cialo_trening'
  when 'sport' then 'cialo_trening'
  else category
end
where category in ('work', 'personal', 'study', 'health', 'sport');

-- 2. vanguard_time_budgets: rename the 1:1 mappings first (no collision risk).
update public.vanguard_time_budgets set category = 'praca' where category = 'work';
update public.vanguard_time_budgets set category = 'relacje_rodzina' where category = 'personal';
update public.vanguard_time_budgets set category = 'duch_refleksja' where category = 'study';

-- 3. Fold sport's bounds into health's row for users who budgeted both, keeping the
--    wider of the two bounds (NULL only when both sides are NULL — "no bound set").
update public.vanguard_time_budgets h
set
  min_hours = case when h.min_hours is null and s.min_hours is null then null
    else greatest(coalesce(h.min_hours, 0), coalesce(s.min_hours, 0)) end,
  max_hours = case when h.max_hours is null and s.max_hours is null then null
    else greatest(coalesce(h.max_hours, 0), coalesce(s.max_hours, 0)) end
from public.vanguard_time_budgets s
where h.category = 'health' and s.category = 'sport' and h.user_id = s.user_id;

-- Drop the now-merged sport row for users who had both.
delete from public.vanguard_time_budgets s
using public.vanguard_time_budgets h
where s.category = 'sport' and h.category = 'health' and h.user_id = s.user_id;

-- Remaining 'health' rows (merged or health-only) and any leftover lone 'sport'
-- rows (no health counterpart) both become cialo_trening — safe now since no user
-- can have both category values left at this point.
update public.vanguard_time_budgets set category = 'cialo_trening' where category = 'health';
update public.vanguard_time_budgets set category = 'cialo_trening' where category = 'sport';

-- 4. New optional column so tasks can be tagged with a life sphere, the same
--    vocabulary as vanguard_calendar.category, feeding the weekly balance hexagon.
alter table public.todo_items add column if not exists category text;
