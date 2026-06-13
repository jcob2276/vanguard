-- Daily morning recompute + Telegram push of the nutrition target.
-- 06:00 UTC = 08:00 Warsaw (summer) / 07:00 (winter).
-- Uses app.* GUCs (same convention as other vanguard crons). body notify=true
-- triggers the Telegram push; userId falls back to VANGUARD_USER_ID in the fn.

select cron.unschedule('vanguard-nutrition-coach')
where exists (select 1 from cron.job where jobname = 'vanguard-nutrition-coach');

select cron.schedule(
  'vanguard-nutrition-coach',
  '0 6 * * *',
  $$
  select net.http_post(
    url      := current_setting('app.supabase_url') || '/functions/v1/vanguard-nutrition-coach',
    headers  := jsonb_build_object(
                  'Content-Type',  'application/json',
                  'Authorization', 'Bearer ' || current_setting('app.service_role_key')
                ),
    body     := '{"notify": true}'::jsonb
  ) as request_id;
  $$
);
