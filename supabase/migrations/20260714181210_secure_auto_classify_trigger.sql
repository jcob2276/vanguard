-- Secure the DB webhook that invokes vanguard-auto-classify. The Edge Function
-- has verify_jwt=false because it is called by pg_net, so the trigger must attach
-- the service-role credential stored in the RLS-protected trigger secret table.
CREATE OR REPLACE FUNCTION public.trigger_vanguard_classification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT secret
    INTO v_key
    FROM public._trigger_secrets
   WHERE name = 'service_role_key';

  IF v_key IS NULL OR length(v_key) < 20 THEN
    RAISE EXCEPTION 'trigger service credential is not configured';
  END IF;

  PERFORM net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-auto-classify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_key
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_vanguard_classification() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_vanguard_classification() TO service_role;

-- Existing pg_net trigger functions are also SECURITY DEFINER. Pin their
-- search_path so caller-controlled schemas cannot affect name resolution.
ALTER FUNCTION public.trigger_vanguard_telegram_worker() SET search_path = '';
ALTER FUNCTION public.trigger_outbound_message_worker() SET search_path = '';
