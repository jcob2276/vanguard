-- Short-lived NL meal previews awaiting Telegram confirm (service role only)
CREATE TABLE IF NOT EXISTS public.food_parse_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL,
  meal_type text NOT NULL,
  items jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_parse_pending_user_created
  ON public.food_parse_pending (user_id, created_at DESC);

ALTER TABLE public.food_parse_pending ENABLE ROW LEVEL SECURITY;

-- No user policies: edge functions use service role for insert/select/delete
