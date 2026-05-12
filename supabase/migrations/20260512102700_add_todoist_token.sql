-- Add todoist_token to user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS todoist_token TEXT;
