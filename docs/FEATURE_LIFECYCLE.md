# Feature Lifecycle

This file is the repository-level status map for integrations, subsystems, and legacy features. Use it before reviving old code paths.

## Status Definitions

- **Active**: production path or actively maintained local path. Bugs should be fixed in-place.
- **Disabled**: intentionally present but not running. Keep isolation, do not extend without explicit reactivation.
- **Deprecated**: replaced or scheduled for removal. Keep compatibility/stubs only.
- **Dropped**: no active runtime path. Do not read, write, mock, or mention as an active signal.
- **Legacy**: historical UI/data model. Build must not break, but new Vanguard Core work should not start here.

## Current Map

| Area | Status | Notes |
|---|---|---|
| Vanguard daily loop | Active | User stream, noon reflective interview, evening reflection. Autonomous morning brief/ping and legacy midday task check are deleted from the codebase; Telegram evening no longer plans tomorrow. |
| Vanguard stream/friction path | Active | Single write path: `vanguard_stream` -> `vanguard-auto-classify` -> `friction_events`. |
| Oracle chat | Active | Reasoning layer only; no direct graph/knowledge writes from chat turns. |
| Oura enhanced/timeseries | Active | Auth-scoped endpoints; user calls are scoped to the authenticated user. |
| Daily strain | Active | `compute-daily-strain` writes `daily_strain`; auth-scoped single-user calls, service-role batch. |
| Strava/Calendar sync | Active | Keep function registry, deploy list, and smoke manifest in sync. |
| Yazio sync | Dropped | Removed 2026-06-26. Nutrition is logged in-app (`daily_nutrition`, `daily_food_entries`, `parse-food-nl`, `lookup-food`). Do not revive `sync-yazio` or store Yazio credentials in settings. |
| Projects | Active | `projects` is the canonical app model for the Projekty section. `todo_sections.project_id` is an optional bridge for project-scoped tasks; projects are not defined by Todo. |
| `project_checkpoints` table | Dropped | Migrated 2026-06-30 (`backfill_project_checkpoints_to_todo_items`, 15/15 rows, then `drop_legacy_project_checkpoints`). Checkpoints are exclusively `todo_items` rows with `is_milestone=true` now — no fallback paths remain in `checkpoints.ts`/`projects.ts`/`projectEvidence.ts`. `daily_wins.task_N_checkpoint_id` now FKs to `todo_items(id)` instead of the dropped table. |
| Todo | Active | `todo_sections` / `todo_items` power the separate Zadania section and quick task surfaces. |
| Career module | Dropped | `career_projects`, `career_moves`, `career_evidence`, and `career_decisions` (legacy from the removed Kariera section) dropped 2026-06-30 (migration `20260630164658_drop_dead_career_and_goals_schema`). |
| Todoist sync | Dropped | Removed 2026-06-13. Vanguard owns tasks/projects natively through `todo_*` and `projects` instead of importing an external todo model. |
| ActivityWatch local import | Active local | Local/manual data import path; not a replacement for dropped StayFree signals. |
| Capacitor Android APK | Active (bootstrap + FCM wiring) | Same `src/` as Vercel PWA; shell in `android/`. Build: `npm run mobile:sync`. FCM dual-send coded; requires Firebase `google-services.json` + edge secrets. See `docs/agent/ACTIVE_WORK.md`. |
| StayFree | Dropped | No active reads/writes/mocks. Digital metrics derived from it must remain `null` until a new declared source exists. Tables `screen_time_logs` / `screen_time_details` dropped 2026-06-11 (migration `20260611213502`); `phone_usage_daily` is NOT StayFree — it belongs to the active ActivityWatch local import path. |
| Observation-only mode | Dropped | Do not reintroduce as an active product mode. |
| Legacy workout UI/tables | Legacy | Existing UI can be stabilized, but new Vanguard Core behavior should use current subsystems. |
| `daily_habits` (fixed columns: stretch, protein_170g…) | Deprecated | No write UI. New habits → `habits`/`habit_logs`. Read-only in old correlation series until data archived. |
| Unmounted web widgets | Dropped | OuraWidget, OuraEnhanced, SleepDebtCard, MentorChat (web Oracle chat), GraphMind, ThoughtStream, IntentionTracker, ManifestationBoard, LocationTracker, AWImporter — deleted 2026-06-11 after being deliberately unmounted in earlier commits; recover from git history if needed. |
| Training plan-vs-Strava Telegram analysis | Dropped | `analyze-training` deleted from the codebase. Do not send plan-vs-Strava LLM reports to Telegram; `analyze-training-load` remains UI-only. |
| Ghost prediction/intervention tables | Dropped | `vanguard_correlations`, `vanguard_temporal_links`, and `vanguard_youtube` dropped 2026-06-11 after their only runtime paths were removed. |
| Declared intentions table | Dropped | `vanguard_intentions` dropped 2026-06-11: no writer, 0 rows, and Oracle read path removed. Rebuild only with explicit user-controlled write/status flow. |
| Morning briefing & RAG diagnostics | Dropped | `vanguard-briefing`, `vanguard-backfill`, and `vanguard-debug-retrieval` Edge Functions dropped 2026-06-20 after being identified as unused or legacy. |
| Legacy WeeklyReview & WeeklyBrief | Dropped | Consolidated into Direction ritual 2026-06-30. `vanguard-weekly-brief` stubbed to 410, `WeeklyReview.tsx` removed. kpi_entries is the single source of truth. |
| `goals` table | Dropped | 0 rows, 0 reads/writes in `src/`. Dropped 2026-06-30 (migration `20260630164658_drop_dead_career_and_goals_schema`) along with its always-NULL FK columns' constraints on `projects.goal_id` / `goal_kpis.goal_id`. |


## Audit Rule

When a feature changes lifecycle status, update:

1. This file.
2. `docs/ARCHITECTURE.md` if it affects runtime flow.
3. `supabase/functions/README.md` if it affects Edge Functions.
4. `scripts/ops/smoke-manifest.mjs` and `scripts/ops/deploy-no-jwt.ps1` if it affects deployment or smoke coverage.
