-- reminder_at + reminder_sent on todo_items
ALTER TABLE public.todo_items
  ADD COLUMN IF NOT EXISTS reminder_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS todo_items_reminder_idx
  ON public.todo_items (reminder_at)
  WHERE reminder_at IS NOT NULL AND reminder_sent = false AND status != 'done';

-- push_subscriptions: one row per browser per user
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);
