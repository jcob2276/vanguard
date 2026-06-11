# PROJECT_MAP — navigation index (read this first if you are new here)

Vanguard OS: personal behavioral OS. Daily loop lives in **Telegram + Supabase edge functions**; the React app in `src/` is the legacy workout/dashboard frontend.

## Read order (cold start)

1. `CLAUDE.md` — hard project rules (timezone, auth, fetch, DB patterns)
2. `AGENTS.md` — agent constitution + deploy rules
3. `supabase/functions/README.md` — registry of all 30 edge functions (SSOT)
4. `docs/ARCHITECTURE.md` — one-page data flow + crons
5. `BACKLOG.md` — intentionally deferred work (do not "fix")

## Top-level folders

| Path | What it is |
|---|---|
| `supabase/functions/` | **Production code.** Deno edge functions; one folder = one deployed function. `_shared/` = kernel helpers (always use these). Do not restructure. |
| `supabase/migrations/` | Applied SQL migrations — filenames immutable. Do not rename/reorder. |
| `src/` | Legacy React frontend (workout, dashboard widgets, sync UI). See `src/README.md`. |
| `src/components/` | Grouped by domain: `core/` (Auth, Dashboard, DataHub, Stats, Fundament, DataStateNotice), `biometrics/` (Oura*, DailyStrainCard, SleepDebtCard, MuscleHeatmap, BrainHealth, WorkoutLogger), `ai/` (AIInsight, MentorChat, GraphMind), `lifestyle/` (PowerList, Direction, GoalsCard, ThoughtStream, IntentionTracker, ManifestationBoard), `integrations/` (StravaWidget, TodoistSync, AWImporter, LocationTracker), `identity/` (IdentityVault, Photos). |
| `docs/` | All documentation. `docs/direction/` = North Star + ETAP plans (PL). `docs/runbooks/` = incident fixes. `docs/README.md` = full index. |
| `examples/` | Canonical code patterns referenced by `CLAUDE.md` — copy these when writing new code. |
| `scripts/` | Local automation, **not** deployed. `ops/` (deploy, smoke, CI), `aw/` (ActivityWatch bridge), `analysis/` (eval/data one-offs). See `scripts/README.md`. |
| `PRPs/` | PRP workflow: `INITIAL.md` (feature request template), `templates/prp_base.md`, generated PRPs. |
| `public/` | Static assets for the PWA. |
| `scratch/` | **Gitignored local junk** — debug scripts, personal notes. Never reference from real code. |

## Known quirks (do not "discover" these as bugs)

- **Orphan components** (defined, currently mounted nowhere): `OuraWidget`, `OuraEnhanced`, `SleepDebtCard`, `MentorChat`, `GraphMind`, `ThoughtStream`, `IntentionTracker`, `ManifestationBoard`, `LocationTracker`, `AWImporter`. Kept intentionally; do not delete without user approval, and do not assume they render.
- `src/lib/vanguardCore.js` re-exports from `supabase/functions/_shared/vanguardCore.ts` — frontend and edge share one implementation.
- Deprecated names (never reference): `stayfreeData`, `dopamine_load_index`, `fragmentation_index`, `screen_time_min`, `ProgressionTable.jsx`, `WorkoutExecution.jsx`, `useStats.js`, `workoutPlan.js`.

## Reorg changelog (2026-06-11)

| Old path | New path |
|---|---|
| `KIERUNEK NAJWAŻNIEJSZE!/*` | `docs/direction/*` (its `ROADMAP_V10.md` / `VISION_10_10.md` stubs deleted — `docs/` versions are canonical) |
| `VANGUARD_MANIFESTO.md`, `GRAPH_TEMPORAL_STATUS.md` | `docs/` |
| `INITIAL.md`, `INITIAL_EXAMPLE.md` | `PRPs/` |
| `demo_sluchawki.txt` | untracked → `scratch/` (personal note) |
| `scratch/goose-bnnett/` | moved out of repo → `..\goose-bnnett` (separate git project) |
| `src/components/*.jsx` (flat) | `src/components/{core,biometrics,ai,lifestyle,integrations,identity}/` |
| `src/components/stats/` | `src/components/core/stats/` |
| `scripts/aw-*.cjs` | `scripts/aw/` |
| `scripts/{smoke-vanguard,smoke-ui,check-edge-functions,oss-audit,e2e-daily-loop}.mjs` | `scripts/ops/` |
| `scripts/{run_eval.js,backfill_triads.js,audit-registry.mjs,analyze-weak-plans.mjs,closure_proposals_review.sql}` | `scripts/analysis/` |
