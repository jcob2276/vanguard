-- Remove autonomous morning Telegram nudges.
--
-- These jobs sent repeated "weak plan" / morning rescue messages when state was
-- not recorded cleanly. Morning planning remains user-initiated through
-- Telegram/Oracle; no cron should nag the user in the morning.

select cron.unschedule('vanguard-morning-brief')
where exists (select 1 from cron.job where jobname = 'vanguard-morning-brief');

select cron.unschedule('vanguard-morning-ping')
where exists (select 1 from cron.job where jobname = 'vanguard-morning-ping');
