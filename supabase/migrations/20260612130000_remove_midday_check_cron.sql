-- Remove autonomous midday Telegram check.
-- The function remains as a 410 compatibility stub, but no cron should call it.

select cron.unschedule('vanguard-midday-check')
where exists (select 1 from cron.job where jobname = 'vanguard-midday-check');
