-- Remove stale dashboard-created Telegram nudge crons.
-- Morning briefing and friction QA are not part of the active daily loop.

select cron.unschedule('vanguard-daily-briefing')
where exists (select 1 from cron.job where jobname = 'vanguard-daily-briefing');

select cron.unschedule('vanguard-friction-qa-daily')
where exists (select 1 from cron.job where jobname = 'vanguard-friction-qa-daily');
