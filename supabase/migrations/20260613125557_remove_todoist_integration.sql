-- Drop the legacy Todoist integration. Vanguard will own tasks/projects natively.

ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS todoist_token;

DROP FUNCTION IF EXISTS public.sync_all_todoist_users();
