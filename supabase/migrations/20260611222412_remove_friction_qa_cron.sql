-- Remove autonomous friction QA Telegram reports.
--
-- vanguard-friction-qa remains available as a manual diagnostic endpoint, but
-- it should not run periodically or push stream excerpts to Telegram.

select cron.unschedule('vanguard-friction-qa')
where exists (select 1 from cron.job where jobname = 'vanguard-friction-qa');
