/**
 * SSOT for post-deploy smoke + deploy --no-verify-jwt lists.
 * Sync: docs/ARCHITECTURE.md (cron table), AGENTS.md (deploy rule).
 */

export const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "YOUR_PROJECT_REF";

/** Edge functions that MUST use verify_jwt: false in production. */
export const NO_VERIFY_JWT_FUNCTIONS = [
  "recap",
  "vanguard-nightly",
  "vanguard-telegram",
  "vanguard-telegram-worker",
  "vanguard-oracle",
  "vanguard-auto-classify",
  "vanguard-architect",
  "vanguard-wiki-compiler",
  "vanguard-analyst",
  "vanguard-eval-runner",
  "vanguard-graph-embedder",
  "sync",
  "analyze-training-load",
  "vanguard-eval-interview",
  "vanguard-nutrition-coach",
  "vanguard-librarian",
  "vanguard-push-reminder",
  "vanguard-capture",
  "vanguard-keep-triage",
  "vanguard-backtester",
  "vanguard-outbox-sender",
];


/**
 * Per-function smoke profile.
 * - options: always run (JWT gateway check, no side effects)
 * - post: only with --invoke-safe or --invoke-crons
 */
export const SMOKE_TARGETS = [
  { name: "recap", post: "safe", body: { type: "daily" }, sideEffects: "Unified recap endpoint — daily/weekly options" },
  { name: "vanguard-analyst", post: "cron", sideEffects: "LLM batch" },
  { name: "vanguard-telegram", post: "webhook", body: { update_id: 0 }, sideEffects: "OPTIONS preferred" },
  { name: "vanguard-telegram-worker", post: "skip", sideEffects: "DB trigger only — no direct HTTP invocation; OPTIONS for health check" },
  { name: "vanguard-oracle", post: "safe", body: { current_query: "smoke", user_id: "__USER__", mode: "chat" }, sideEffects: "Calls DeepSeek — use only with --invoke-safe" },
  { name: "vanguard-auto-classify", post: "safe", body: {}, sideEffects: "Returns 200, no classify" },
  { name: "vanguard-architect", post: "safe", body: { limit: 0 }, sideEffects: "DB read only" },
  { name: "vanguard-wiki-compiler", post: "skip", sideEffects: "Calls DeepSeek + writes derived wiki pages" },
  { name: "vanguard-eval-runner", post: "skip", sideEffects: "Manual eval batch — OPTIONS only" },
  { name: "vanguard-eval-interview", post: "cron", sideEffects: "Sends Telegram eval question — OPTIONS preferred for smoke" },
  { name: "vanguard-graph-embedder", post: "skip", sideEffects: "Manual embedding batch — OPTIONS only" },
  { name: "sync", post: "safe", body: { service: "oura" }, sideEffects: "Calls Oura API — OPTIONS preferred for smoke" },
  { name: "vanguard-nightly", post: "safe", body: { action: "compute-correlations" }, sideEffects: "Unified nightly pipeline" },
  { name: "analyze-training-load", post: "skip", sideEffects: "Calls DeepSeek — manual trigger only" },
  { name: "vanguard-nutrition-coach", post: "skip", sideEffects: "Calls DeepSeek + writes nutrition target — OPTIONS only" },
  { name: "vanguard-librarian", post: "skip", sideEffects: "Calls DeepSeek + writes food_library entries — OPTIONS only" },
  { name: "vanguard-push-reminder", post: "skip", sideEffects: "Sends web push notifications for reminders" },
  { name: "vanguard-capture", post: "skip", sideEffects: "Unified capture endpoint (text/link/voice)" },
  { name: "vanguard-keep-triage", post: "skip", sideEffects: "AI triage for unread links (calls DeepSeek)" },
  { name: "vanguard-backtester", post: "skip", sideEffects: "Historical backtest simulation — OPTIONS only for smoke" },
  { name: "vanguard-outbox-sender", post: "skip", sideEffects: "Sends Telegram messages from outbox queue asynchronously" },
];

/** pg_cron jobs defined in repo migrations (verify live DB matches). */
export const CRON_FROM_MIGRATIONS = [
  { jobname: "vanguard-daily-snapshot", schedule: "0 4 * * *", target: "vanguard-nightly" },
  { jobname: "vanguard-daily-analyst", schedule: "0 3 * * *", target: "vanguard-analyst" },
  { jobname: "vanguard-wiki-compiler", schedule: "20 3 * * *", target: "vanguard-wiki-compiler" },
  { jobname: "sync-oura-morning", schedule: "30 7 * * *", target: "sync?service=oura" },
  { jobname: "sync-oura-evening", schedule: "0 19 * * *", target: "sync?service=oura" },
  { jobname: "vanguard-eval-interview", schedule: "0 10 * * 1-5", target: "vanguard-eval-interview" },
];

/** Documented in ops; may exist only in Supabase Dashboard — confirm with cron-check.sql */
export const CRON_DASHBOARD_ONLY = [
  { jobname: "vanguard-daily-reconciliation", schedule_hint: "~19:30 UTC", target: "recap?type=daily" },
  { jobname: "vanguard-weekly-synthesis", schedule_hint: "Sun ~17:00 UTC", target: "recap?type=weekly-synthesis" },
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
