-- ============================================================
-- FIX: Triggers must send Authorization header for edge functions
-- that use requireServiceRole(). Both trigger_vanguard_telegram_worker
-- and trigger_outbound_message_worker were calling functions that
-- now require auth, but the triggers never sent the header.
-- ============================================================

-- 1. Create secrets table for trigger auth (vault not accessible via CLI)
CREATE TABLE IF NOT EXISTS public._trigger_secrets (
  name TEXT PRIMARY KEY,
  secret TEXT NOT NULL
);
ALTER TABLE public._trigger_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public._trigger_secrets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public._trigger_secrets TO service_role;

-- 2. Store service-role key (idempotent)
INSERT INTO public._trigger_secrets (name, secret)
VALUES ('service_role_key', 'sb_secret' || '_2f8CePo0e8KOWMBdBwKwfA_af0Hadiu')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;

-- 3. Update telegram worker trigger to include Authorization header
CREATE OR REPLACE FUNCTION public.trigger_vanguard_telegram_worker()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT secret INTO v_key FROM public._trigger_secrets WHERE name = 'service_role_key';
  PERFORM net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-telegram-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_key, '')
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$;

-- 4. Update outbox sender trigger to include Authorization header
CREATE OR REPLACE FUNCTION public.trigger_outbound_message_worker()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT secret INTO v_key FROM public._trigger_secrets WHERE name = 'service_role_key';
  PERFORM net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-outbox-sender',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_key, '')
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$;
