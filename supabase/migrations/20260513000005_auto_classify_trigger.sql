-- ============================================================
-- VANGUARD OS — AUTO-CLASSIFY TRIGGER (TASK-02)
-- Automatyczne uderzanie w Edge Function przy każdym INSERT
-- ============================================================

-- 1. UPEWNIJ SIĘ, ŻE PG_NET JEST AKTYWNE
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. FUNKCJA WYZWALAJĄCA
CREATE OR REPLACE FUNCTION public.trigger_vanguard_classification()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/vanguard-auto-classify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. TRIGGER
DROP TRIGGER IF EXISTS tr_vanguard_auto_classify ON public.vanguard_stream;
CREATE TRIGGER tr_vanguard_auto_classify
AFTER INSERT ON public.vanguard_stream
FOR EACH ROW
EXECUTE FUNCTION public.trigger_vanguard_classification();
