/**
 * SSOT for post-deploy smoke + deploy --no-verify-jwt lists.
 * Sync: docs/ARCHITECTURE.md (cron table), AGENTS.md (deploy rule).
 */

export const PROJECT_REF = "pdvqkgfsqziqlhptatgf";

/** Edge functions that MUST use verify_jwt: false in production. */
export const NO_VERIFY_JWT_FUNCTIONS = [
  "vanguard-morning-brief",
  "vanguard-morning-ping",
  "vanguard-midday-check",
  "vanguard-daily-reconciliation",
  "vanguard-intentions-cleanup",
  "vanguard-weekly-synthesis",
  "vanguard-friction-qa",
  "vanguard-telegram",
  "dojo-telegram",
  "dojo-scheduler",
  "vanguard-oracle",
  "vanguard-auto-classify",
  "vanguard-architect",
  "ingest-vault-log",
  "vanguard-analyst",
  "save-daily-aggregate",
  "sync-strava",
  "analyze-training",
];

/**
 * Per-function smoke profile.
 * - options: always run (JWT gateway check, no side effects)
 * - post: only with --invoke-safe or --invoke-crons
 */
export const SMOKE_TARGETS = [
  { name: "vanguard-morning-brief", post: "cron", sideEffects: "May send Telegram if plan exists and not sent" },
  { name: "vanguard-morning-ping", post: "cron", sideEffects: "May send Telegram nudge" },
  { name: "vanguard-midday-check", post: "cron", sideEffects: "May send midday Telegram" },
  { name: "vanguard-daily-reconciliation", post: "cron", sideEffects: "May send evening reconciliation Telegram" },
  { name: "vanguard-intentions-cleanup", post: "cron", sideEffects: "LLM + DB writes" },
  { name: "vanguard-weekly-synthesis", post: "cron", sideEffects: "LLM + Telegram report" },
  { name: "vanguard-friction-qa", post: "cron", sideEffects: "LLM + Telegram" },
  { name: "vanguard-analyst", post: "cron", sideEffects: "LLM batch" },
  { name: "save-daily-aggregate", post: "cron_secret", sideEffects: "Writes daily aggregate" },
  { name: "dojo-scheduler", post: "cron", sideEffects: "May message Dojo bot" },
  { name: "dojo-telegram", post: "webhook", body: { message: { message_id: 0, chat: { id: 0 } } }, sideEffects: "Use OPTIONS only unless testing Dojo" },
  { name: "vanguard-telegram", post: "webhook", body: { update_id: 0 }, sideEffects: "OPTIONS preferred" },
  { name: "vanguard-oracle", post: "safe", body: { current_query: "smoke", user_id: "__USER__", mode: "chat" }, sideEffects: "Calls DeepSeek — use only with --invoke-safe" },
  { name: "vanguard-auto-classify", post: "safe", body: {}, sideEffects: "Returns 200, no classify" },
  { name: "vanguard-architect", post: "safe", body: { limit: 0 }, sideEffects: "DB read only" },
  { name: "ingest-vault-log", post: "skip", sideEffects: "Requires long text — OPTIONS only" },
  { name: "vanguard-reset-prompt", post: "safe", body: {}, expectStatus: [410], sideEffects: "Deprecated stub" },
  { name: "sync-strava", post: "safe", body: {}, sideEffects: "Calls Strava API + token refresh — OPTIONS preferred for smoke" },
  { name: "analyze-training", post: "skip", sideEffects: "Calls DeepSeek + Telegram — manual trigger only" },
];

/** pg_cron jobs defined in repo migrations (verify live DB matches). */
export const CRON_FROM_MIGRATIONS = [
  { jobname: "vanguard-daily-snapshot", schedule: "0 4 * * *", target: "save-daily-aggregate (via trigger_daily_snapshots)" },
  { jobname: "vanguard-daily-analyst", schedule: "0 3 * * *", target: "vanguard-analyst" },
  { jobname: "vanguard-morning-brief", schedule: "0 5 * * *", target: "vanguard-morning-brief" },
  { jobname: "vanguard-morning-ping", schedule: "20 5 * * *", target: "vanguard-morning-ping" },
  { jobname: "vanguard-weekly-intentions-cleanup", schedule: "0 0 * * 0", target: "vanguard-intentions-cleanup" },
  { jobname: "vanguard-sync-strava", schedule: "30 20 * * *", target: "sync-strava" },
];

/** Documented in ops; may exist only in Supabase Dashboard — confirm with cron-check.sql */
export const CRON_DASHBOARD_ONLY = [
  { jobname: "vanguard-midday-check", schedule_hint: "~11:00 UTC", target: "vanguard-midday-check" },
  { jobname: "vanguard-daily-reconciliation", schedule_hint: "~19:30 UTC", target: "vanguard-daily-reconciliation" },
  { jobname: "vanguard-weekly-synthesis", schedule_hint: "Sun ~17:00 UTC", target: "vanguard-weekly-synthesis" },
  { jobname: "vanguard-friction-qa", schedule_hint: "periodic", target: "vanguard-friction-qa" },
  { jobname: "dojo-scheduler-morning", schedule_hint: "0 6 * * *", target: "dojo-scheduler" },
  { jobname: "dojo-scheduler-afternoon", schedule_hint: "0 13 * * *", target: "dojo-scheduler" },
];

export const CRON_REMOVED = [
  "vanguard-reset-prompt",
  "vanguard-reset-prompt-cron",
  "vanguard-daily-shadow-analysis",
];
