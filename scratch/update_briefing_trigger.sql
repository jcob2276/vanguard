CREATE OR REPLACE FUNCTION public.trigger_daily_snapshots(secret_key text)
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.user_settings LOOP
    PERFORM net.http_post(
      url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-briefing',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || secret_key
      ),
      body := jsonb_build_object('userId', r.user_id),
      timeout_milliseconds := 15000
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
