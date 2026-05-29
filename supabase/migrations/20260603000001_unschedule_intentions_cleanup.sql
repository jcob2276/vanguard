-- ============================================================
-- VANGUARD OS — RETIRE WEEKLY INTENTIONS CLEANUP
-- ============================================================
-- vanguard-intentions-cleanup autonomicznie ustawiał status='manifested'
-- na intencjach użytkownika — co łamie docs/PRODUCT_PRINCIPLES.md "Transurfing
-- Layer Guardrail" (system NIGDY nie twierdzi, że manifestacja zadziałała).
-- Status zmienia teraz wyłącznie użytkownik. Logika konfrontacji
-- deklaracja-vs-zachowanie przeniesiona do warstwy CZYTANIA (Oracle).
-- Funkcja zwraca HTTP 410. Ten skrypt usuwa harmonogram (idempotentnie).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('vanguard-weekly-intentions-cleanup');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'unschedule intentions-cleanup: %', SQLERRM;
END;
$$;
