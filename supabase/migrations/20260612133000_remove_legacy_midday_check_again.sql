-- The active noon Telegram flow is vanguard-eval-interview.
-- Remove the legacy task/artifact midday check cron.

select cron.unschedule('vanguard-midday-check')
where exists (select 1 from cron.job where jobname = 'vanguard-midday-check');
