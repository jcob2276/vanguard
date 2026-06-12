/**
 * SSOT for post-deploy smoke + deploy --no-verify-jwt lists.
 * Sync: docs/ARCHITECTURE.md (cron table), AGENTS.md (deploy rule).
 */

export const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "YOUR_PROJECT_REF";

/** Edge functions that MUST use verify_jwt: false in production. */
export const NO_VERIFY_JWT_FUNCTIONS = [
  "vanguard-daily-reconciliation",
  "vanguard-weekly-synthesis",
  "vanguard-telegram",
  "vanguard-oracle",
  "vanguard-auto-classify",
  "vanguard-architect",
  "vanguard-wiki-compiler",
  "ingest-vault-log",
  "vanguard-analyst",
  "vanguard-eval-runner",
  "vanguard-graph-embedder",
  "save-daily-aggregate",
  "sync-strava",
  "analyze-training-load",
  "vanguard-eval-interview",
];

/**
 * Per-function smoke profile.
 * - options: always run (JWT gateway check, no side effects)
 * - post: only with --invoke-safe or --invoke-crons
 */
export const SMOKE_TARGETS = [
  { name: "vanguard-morning-brief", post: "safe", body: {}, expectStatus: [410], sideEffects: "Deprecated stub; no Telegram" },
  { name: "vanguard-morning-ping", post: "safe", body: {}, expectStatus: [410], sideEffects: "Deprecated stub; no Telegram" },
  { name: "vanguard-midday-check", post: "safe", body: {}, expectStatus: [410], sideEffects: "Deprecated stub; no Telegram" },
  { name: "vanguard-daily-reconciliation", post: "cron", sideEffects: "May send evening reconciliation Telegram" },
  { name: "vanguard-weekly-synthesis", post: "cron", sideEffects: "LLM + Telegram report" },
  { name: "vanguard-friction-qa", post: "safe", body: {}, expectStatus: [410], sideEffects: "Deprecated stub; no Telegram" },
  { name: "vanguard-analyst", post: "cron", sideEffects: "LLM batch" },
  { name: "save-daily-aggregate", post: "cron_secret", sideEffects: "Writes daily aggregate" },
  { name: "vanguard-telegram", post: "webhook", body: { update_id: 0 }, sideEffects: "OPTIONS preferred" },
  { name: "vanguard-oracle", post: "safe", body: { current_query: "smoke", user_id: "__USER__", mode: "chat" }, sideEffects: "Calls DeepSeek — use only with --invoke-safe" },
  { name: "vanguard-auto-classify", post: "safe", body: {}, sideEffects: "Returns 200, no classify" },
  { name: "vanguard-architect", post: "safe", body: { limit: 0 }, sideEffects: "DB read only" },
  { name: "vanguard-wiki-compiler", post: "skip", sideEffects: "Calls DeepSeek + writes derived wiki pages" },
  { name: "vanguard-eval-runner", post: "skip", sideEffects: "Manual eval batch — OPTIONS only" },
  { name: "vanguard-eval-interview", post: "cron", sideEffects: "Sends Telegram eval question — OPTIONS preferred for smoke" },
  { name: "vanguard-graph-embedder", post: "skip", sideEffects: "Manual embedding batch — OPTIONS only" },
  { name: "ingest-vault-log", post: "skip", sideEffects: "Requires long text — OPTIONS only" },
  { name: "sync-strava", post: "safe", body: {}, sideEffects: "Calls Strava API + token refresh — OPTIONS preferred for smoke" },
  { name: "analyze-training", post: "safe", body: {}, expectStatus: [410], sideEffects: "Deprecated stub; no DeepSeek, no Telegram" },
  { name: "compute-correlations", post: "skip", sideEffects: "Read-only correlation scan; requires authenticated user scope" },
  { name: "analyze-training-load", post: "skip", sideEffects: "Calls DeepSeek — manual trigger only" },
];

/** pg_cron jobs defined in repo migrations (verify live DB matches). */
export const CRON_FROM_MIGRATIONS = [
  { jobname: "vanguard-daily-snapshot", schedule: "0 4 * * *", target: "save-daily-aggregate (via trigger_daily_snapshots)" },
  { jobname: "vanguard-daily-analyst", schedule: "0 3 * * *", target: "vanguard-analyst" },
  { jobname: "vanguard-wiki-compiler", schedule: "20 3 * * *", target: "vanguard-wiki-compiler" },
  { jobname: "vanguard-sync-strava", schedule: "30 20 * * *", target: "sync-strava" },
  { jobname: "vanguard-eval-interview", schedule: "0 10 * * 1-5", target: "vanguard-eval-interview" },
];

/** Documented in ops; may exist only in Supabase Dashboard — confirm with cron-check.sql */
export const CRON_DASHBOARD_ONLY = [
  { jobname: "vanguard-daily-reconciliation", schedule_hint: "~19:30 UTC", target: "vanguard-daily-reconciliation" },
  { jobname: "vanguard-weekly-synthesis", schedule_hint: "Sun ~17:00 UTC", target: "vanguard-weekly-synthesis" },
];

export const CRON_REMOVED = [
  "vanguard-morning-brief",
  "vanguard-morning-ping",
  "vanguard-midday-check",
  "vanguard-daily-briefing",
  "vanguard-friction-qa-daily",
  "vanguard-daily-shadow-analysis",
  "vanguard-weekly-intentions-cleanup",
  "vanguard-reset-prompt",
  "vanguard-reset-prompt-cron",
  "weekly-report",
];
