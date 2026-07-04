-- Hygiene fix: 4 tables allowed NULL user_id (orphaned-row risk under their own
-- RLS filters), and 3 tables had no index on user_id. Verified zero existing
-- NULL rows before tightening.

alter table public.vanguard_entity_links alter column user_id set not null;
alter table public.vanguard_oracle_runs alter column user_id set not null;
alter table public.vanguard_preferences alter column user_id set not null;
alter table public.vanguard_entity_aliases alter column user_id set not null;

create index if not exists idx_vanguard_curiosity_queue_user_id on public.vanguard_curiosity_queue(user_id);
create index if not exists idx_vanguard_preferences_user_id on public.vanguard_preferences(user_id);
create index if not exists idx_vanguard_entity_aliases_user_id on public.vanguard_entity_aliases(user_id);
