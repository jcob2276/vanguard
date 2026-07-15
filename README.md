# Vanguard OS

> **A personal operating system built for one person.** Not a productivity app. Not a wellness tracker. A continuous behavioral memory system and predictive health engine that turns daily action into signal — and signal into better decisions.

Built solo. Running daily. 

---

## 🌌 The Core Philosophy: "Everything Sees Itself"

Most life-tracking apps live in silos. Oura knows your HRV, Strava knows your running pace, and your Todo app knows your tasks. **They don't talk to each other. Vanguard does.**

In Vanguard OS, everything is interconnected. Your daily recovery score knows if you hit your *PowerList* (5 Tasks a Day). Your food logging engine adjusts based on the training load from Strava. The AI Oracle understands when you are entering a "Downward Spiral" because it sees the correlation between your late sleep, missed tasks, and elevated friction events. It is a holistic, self-aware system built on top of a massive Knowledge Graph.

---

## 🏗️ Architecture: A Dual-Layer Ecosystem

Vanguard is heavily decoupled. The intelligence runs entirely in the background via Edge Functions, while the frontend acts as a "read-heavy" Memex interface to visualize the state of the system.

### Tech Stack
- **Frontend (The Memex):** React 19 + TypeScript + Vite + TailwindCSS 4 (SPA on Vercel).
- **Backend (The Brain):** Supabase (PostgreSQL, Auth, RLS, pg_cron).
- **Microservices:** 30+ independent Deno Edge Functions.
- **AI Engine:** DeepSeek v4 Flash (for structured NLP extraction and Oracle reasoning) + OpenAI Whisper (voice processing).
- **Primary Input:** Telegram Bot (webhook-driven quick capture).

---

## 🧠 The Intelligence Layer (Backend)

The backend (`supabase/functions/`) is a sprawling ecosystem of 30+ microservices doing specialized work. It does not rely on simple CRUD; it operates as an active intelligence layer.

### 1. Data Ingestion & NLP
- **`vanguard-telegram`**: The central router for all incoming text and voice notes.
- **`parse-food-nl` / `parse-workout-nl`**: Natural language engines that convert messy user voice messages ("zjadłem 200g kurczaka", "zrobiłem 5 serii martwego ciągu 140kg") into atomic database rows.
- **`sync-oura-timeseries` / `sync-strava` / `sync-calendar`**: Passive data bridges constantly pulling in biometrics, workouts, and calendar blocks.

### 2. Predictive Models & Strain Engines (Custom "Noop" Algorithms)
We don't trust generic wearables. Vanguard takes raw data and recalculates it for a marathon-training, high-performance context.
- **`compute-daily-strain`**: Merges Oura readiness, Strava CNS load, and sleep debt into a true daily score.
- **`compute-recovery-forecast` & `compute-illness-signal`**: Predictive models anticipating burn-out or sickness before physical symptoms appear, based on deviations in RHR, HRV, and behavioral friction.
- **`analyze-training-load` & `analyze-food-quality`**: Deep-dive analytics recalculating macro targets and training frequency on the fly.

### 3. Behavioral Memory (The Friction & Recovery Pipeline)
- **`vanguard-auto-classify`**: Scans the stream of consciousness and extracts **Friction Events** (procrastination, avoidance) and **Recovery Anchors** (adaptive moves, breaking a bad habit).
- **`vanguard-detect-patterns` / `vanguard-eval-interview`**: Nightly cron jobs that aggregate friction data to detect State Transitions (e.g., Momentum vs. Downward Spiral).

---

## 🖥️ The Memex Layer (Frontend)

The web dashboard (`src/`) is built on the concept of the **Memex** — a dynamic timeline of Cards and Widgets, moving away from static dashboards. The frontend is strictly domain-driven:

- **`desktop/` (The Cockpit):** The heavy-duty command center (`SprintMetricsGrid`, `SmartAlerts`, `MarathonPanel`).
- **`growth/` (Interventional Learning):** Tracks life experiments and skill mastery (`GrowthVault`, `SkillTreePanel`). If you declare an intervention (e.g., "no screens after 22:00"), Vanguard measures its exact impact on your HRV and task completion.
- **`medical/` (Biology & Labs):** Deep integration of blood work, lab results, and biology scores (`MedicalBiologyScores`, `MedicalTrendCharts`).
- **`lifestyle/` (Execution):** The PowerList (strict 5-tasks-a-day enforcement), Direction Radar, and Goal tracking.
- **`insights/` & `stats/`:** Cross-domain analytics showing you how your physical metrics correlate with your psychological friction.
- **`cards/`:** The atomic building blocks of the UI. Highly modular entity cards (`temporal`, `quantifiable`, `textual`, `visual`).

---

## 📂 Directory Structure

```text
vanguard-os/
├── src/                    # The Memex UI (React 19)
│   ├── components/
│   │   ├── cards/          # Atomic timeline blocks (entities, quantifiable, etc.)
│   │   ├── desktop/        # The main Cockpit and dashboards
│   │   ├── growth/         # Skill trees and Interventional Learning
│   │   ├── lifestyle/      # PowerList and execution radar
│   │   ├── medical/        # Lab results and biological trend charts
│   │   └── stats/          # Cross-domain analytics and data visualization
│   └── lib/                # Shared frontend logic and API clients
├── supabase/
│   ├── functions/          # The Brain (30+ Deno Edge Functions)
│   │   ├── compute-*       # Calculation engines (strain, illness, forecasts)
│   │   ├── parse-*         # NLP extraction engines (food, workouts)
│   │   ├── sync-*          # Third-party data syncs (Oura, Strava)
│   │   ├── vanguard-*      # Core AI systems (Oracle, Classifier, Telegram router)
│   │   └── _shared/        # Shared kernel logic (DB, LLM, time)
│   └── migrations/         # PostgreSQL schema (70+ interconnected tables)
├── docs/                   # Knowledge Base
│   ├── ARCHITECTURE.md     # System design and data flow
│   ├── PRODUCT_PRINCIPLES.md # The unshakeable laws of the Vanguard AI
│   └── BACKEND_CONTRACT.md  # Technical contribution rules (backend contract)
└── scripts/                # Local automation and analytics scripts
```

---

## 📜 Core Guardrails (The Constitution)
Vanguard operates under a strict constitution (`AGENTS.md` and `PRODUCT_PRINCIPLES.md`):
1. **Evidence Layer ≠ Reasoning Layer:** The AI reads evidence, but it never alters the factual logs without explicit human confirmation.
2. **No Psychoanalysis:** The system measures behavior based on raw data; it does not invent psychological narratives.
3. **Timezone Enforcement:** Everything operates strictly in `Europe/Warsaw`. 
4. **User Correction is Signal:** If the user rejects an AI insight, it is logged as highly valuable correction data.

---

*This is a highly opinionated, single-player system built for a specific lifestyle. If you're building a life-tracking data layer or a behavioral OS, feel free to steal the architecture, prompts, and code patterns.*
