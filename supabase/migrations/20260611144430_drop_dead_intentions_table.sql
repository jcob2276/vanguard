-- Drop dead declared-intentions table.
--
-- The web IntentionTracker was removed, no Telegram write path exists,
-- live row count was 0, and Oracle/context read paths were removed in
-- the same change. If declared intentions return, rebuild through a PRP
-- with an explicit user-controlled write/status path.

DROP TABLE IF EXISTS public.vanguard_intentions;
