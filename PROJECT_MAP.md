# PROJECT_MAP — The Complete Vanguard OS Directory

Vanguard OS: A personal behavioral OS. The intelligence and daily loop live in **Telegram + Supabase edge functions**; the visual layer and compiled memory live in the **React app (`src/`)**.

## 🗺️ Top-level Architecture

| Path | Purpose |
|---|---|
| `supabase/functions/` | **The Brain.** Deno Edge Functions (30+ microservices) running CRONs, webhooks, and AI logic. |
| `src/` | **The Memex UI.** React 19 Frontend handling data visualization, timelines, and specialized panels. |
| `supabase/migrations/` | Applied SQL migrations for the PostgreSQL database. Immutable. |
| `docs/` | **Knowledge Base.** `ARCHITECTURE.md`, `PRODUCT_PRINCIPLES.md`, `DEV_GUIDE.md`. |
| `scripts/` | **Ops & CI.** Local automation (`ops/`), eval scripts, testing. |

---

## 🧠 Backend Ecosystem: `supabase/functions/`

The backend is split into independent edge functions. Each folder is one deployed Deno function.

### 1. Vanguard Core (AI & Logic)
- `vanguard-oracle` — Main Conversational AI agent handling context and answers.
- `vanguard-telegram` — Webhook handler and router for all Telegram interactions.
- `vanguard-auto-classify` — NLP pipeline for extracting friction and recovery events.
- `vanguard-daily-reconciliation` — Evening reflection loop.
- `vanguard-detect-patterns` / `vanguard-eval-interview` — Behavioral pattern analysis.
- `vanguard-weekly-synthesis` / `vanguard-week-recap` — Weekly aggregation engines.

### 2. Strain & Medical Engine ("Noop" Algorithms)
- `compute-daily-strain` — Recalculates Oura data against workout load.
- `compute-behavior-effects` / `compute-correlations` — Links biometrics to task completion.
- `compute-recovery-forecast` / `compute-illness-signal` — Predictive health models.
- `analyze-training-load` / `analyze-food-quality` — Specialized deep-dive scoring.

### 3. Sync & Data Bridges (Passive Inputs)
- `sync-oura` / `sync-oura-enhanced` / `sync-oura-timeseries` — Biometrics pull.
- `sync-strava` — Training load pull.
- `sync-calendar` — Schedule pull.

### 4. Special Tools & Parsers
- `parse-food-nl` / `parse-workout-nl` / `lookup-food` — Natural language parsing for quick-capture.
- `vanguard-graph-embedder` — Vector embeddings for the Knowledge Graph.
- `_shared/` — **CRITICAL.** Shared kernel helpers (`deepseek.ts`, `telegram.ts`, `supabase.ts`). Always import from here.

---

## 🖥️ Frontend Ecosystem: `src/`

The frontend has grown into a massive Memex layer. It is organized by domain and component type.

### 1. The Memex Cards (`src/components/cards/`)
The building blocks of the timeline and compiled memory.
- `entities/` (person, place, link)
- `quantifiable/` (metric, mood, progress)
- `temporal/` (event, routine, task)
- `textual/` (article, insight_summary)
- `visual/` (canvas, video, snapshot)

### 2. Core Modules (`src/components/`)
- `desktop/` — The heavy-duty "Cockpit" dashboard (`DesktopDashboard`, `SprintMetricsGrid`, `SmartAlerts`, `MarathonPanel`).
- `growth/` — Interventional learning and skill tracking (`GrowthVault`, `SkillTreePanel`, `GrowthProjectsPanel`).
- `lifestyle/` — PowerList, direction radar, goals (`PowerList`, `WeeklyAnalytics`, `DirectionPlanningMode`).
- `medical/` — Deep dive into biology (`MedicalBiologyScores`, `MedicalLabSections`, `MedicalTrendCharts`).
- `stats/` — Cross-domain analytics (`WorkoutHistorySection`, `BodyMetricsSection`, `FoodAnalysisSection`).
- `insights/` / `projects/` / `todo/` / `schedule/` — Domain-specific views.

### 3. Infrastructure & Logic (`src/`)
- `widgets/` — Reusable charts and specialized visual components (`RadarChart`, `RouteMapCard`, `CompositionCard`).
- `ui/` — Design system primitives and UI blocks.
- `lib/` — Frontend API clients, parsers, and local business logic (`vanguardCore.ts`, `supabaseUtils.ts`, `dailyPlan.ts`).
- `hooks/` — Custom React hooks for data fetching and state (`useDashboardData`, `useGrowthData`, `useMedicalData`).

---

## 🔒 Runtime Boundaries & Rules

1. **`supabase/functions/_shared/` is the single source of truth for logic.** If frontend needs complex scoring, it should rely on the DB or shared logic, not duplicate it in React.
2. **Never commit secrets.** The `git push` rule is active. If you test edge functions, use `.env.local`.
3. **No Phantom Code.** The frontend has been purged of dead modules (like old generic Oura widgets or ManifestationBoards). If you see a file, it's either active or a deliberate part of the Memex.
