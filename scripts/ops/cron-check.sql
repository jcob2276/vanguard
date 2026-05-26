-- Vanguard OS — verify pg_cron jobs (run in Supabase SQL Editor)
-- Compare output to scripts/ops/smoke-manifest.mjs (CRON_FROM_MIGRATIONS + CRON_DASHBOARD_ONLY)

-- 1) All active jobs
SELECT
  jobid,
  jobname,
  schedule,
  active,
  LEFT(command, 120) AS command_preview
FROM cron.job
ORDER BY jobname;

-- 2) Jobs that should NOT exist (deprecated / duplicate)
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname IN (
  'vanguard-reset-prompt',
  'vanguard-reset-prompt-cron',
  'vanguard-daily-shadow-analysis'
);

-- 3) Expected from migrations (should return rows when scheduled)
SELECT jobname
FROM cron.job
WHERE jobname IN (
  'vanguard-daily-snapshot',
  'vanguard-daily-analyst',
  'vanguard-morning-brief',
  'vanguard-morning-ping',
  'vanguard-weekly-intentions-cleanup'
)
ORDER BY jobname;

-- 4) Dashboard-only (confirm manually — empty result here is OK if not created yet)
SELECT jobname, schedule
FROM cron.job
WHERE jobname ILIKE '%midday%'
   OR jobname ILIKE '%reconcil%'
   OR jobname ILIKE '%weekly-synth%'
   OR jobname ILIKE '%friction-qa%'
   OR jobname ILIKE '%dojo%'
   OR jobname ILIKE '%weekly-report%'
ORDER BY jobname;
