-- ============================================================
-- VANGUARD OS — DAILY SNAPSHOT SCHEDULER
-- Wersja: 1.0 | Data: 2026-05-13
-- ============================================================

-- 1. AKTYWACJA ROZSZERZEŃ
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. FUNKCJA TRIGGERUJĄCA SNAPSHOTY DLA WSZYSTKICH UŻYTKOWNIKÓW
-- Przechodzi przez tabelę user_settings i dla każdego użytkownika
-- wywołuje Edge Function save-daily-aggregate.
CREATE OR REPLACE FUNCTION public.trigger_daily_snapshots(secret_key text)
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.user_settings LOOP
    PERFORM net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/save-daily-aggregate',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || secret_key
      ),
      body := jsonb_build_object('userId', r.user_id),
      timeout_milliseconds := 5000
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. HARMONOGRAM CRON
-- Ustawienie na 04:00 UTC, co odpowiada 06:00 CEST (Polska, lato UTC+2).
-- Zastąp 'YOUR_VANGUARD_CRON_SECRET' faktycznym kluczem zdefiniowanym w Supabase Dashboard.

SELECT cron.schedule(
  'vanguard-daily-snapshot',
  '0 4 * * *',
  $$ SELECT public.trigger_daily_snapshots('YOUR_VANGUARD_CRON_SECRET') $$
);

-- KOMENTARZ INSTRUKTAŻOWY:
-- Aby zmienić klucz lub godzinę, użyj:
-- SELECT cron.unschedule('vanguard-daily-snapshot');
-- A następnie uruchom powyższy SELECT cron.schedule z nowymi parametrami.
