# Vanguard OS

**A personal operating system built for one person.** Not a productivity app. Not a wellness tracker. A longitudinal system that turns daily behavior into signal — and signal into better decisions.

Built solo. Running daily. 3 months in.

---

## What it actually is

Most life apps collect data. Vanguard connects it.

Oura knows your HRV. Strava knows your kilometers. Yazio knows your macros. Google Calendar knows your schedule. ActivityWatch knows where your time goes. Your gym logger knows your sets and reps.

None of them talk to each other. Vanguard does.

The result: a system that knows when you're under-fueled for tomorrow's long run, when your CNS load is too high to add strength work, when your sleep debt is accumulating faster than your marathon training can absorb, and when the gap between what you planned and what you did is widening.

It doesn't tell you what to do. It shows you what's actually happening.

---

## Architecture

```
Passive inputs                    Active inputs
─────────────                     ─────────────
Oura Ring     ──┐                 Telegram bot   ──┐
Strava        ──┤                 Workout logger ──┤
Yazio         ──┤──▶  Supabase   Web app        ──┤──▶  Supabase
Google Cal    ──┤     (70+ tables)               │     Edge Functions
ActivityWatch ──┘                               ──┘     (33 functions)
                                                         │
                                              ┌──────────┼──────────┐
                                              ▼          ▼          ▼
                                           Oracle    Analyst    Nutrition
                                           (chat)    (3am cron) (coach)
                                              │          │          │
                                              └──────────┴──────────┘
                                                         │
                                                    Telegram push
                                                    Web dashboard
```

**Frontend:** React 19 + TypeScript + Vite + TailwindCSS 4  
**Backend:** Supabase (PostgreSQL + Auth + RLS + Edge Functions on Deno)  
**AI:** DeepSeek (V3 for structured output, temperature 0.35)  
**Primary AI channel:** Telegram bot — morning brief, evening close, on-demand  
**Deployment:** Vercel (frontend) + Supabase (backend)

---

## Core modules

### Daily loop
The system runs a structured daily cycle — not a reminder, a reasoning cycle.

- **Morning** — Oura readiness + nutrition target + training plan for the day, pushed to Telegram
- **Midday** — check-in on energy, focus blocks, PowerList progress
- **Evening** — `/koniec` command triggers reconciliation: voice/stream events → Deepseek → reflective questions → planning summary stored for Oracle context
- **3am cron** — `vanguard-analyst` runs cross-module pattern analysis while you sleep

### Biometrics
Passive sync every few hours. No manual entry required.

| Source | Data |
|---|---|
| Oura Ring | HRV, sleep stages, readiness, RHR, body temperature |
| Strava | Runs, rides, elevation, HR zones |
| Yazio | Calories, protein, carbs, fat per meal |
| Google Calendar | Events, blocks, time budget |
| ActivityWatch | Screen time, app categories, focus periods |

### Daily strain engine
`compute-daily-strain` runs after each biometric sync and produces:

- **Strain score** (0–100) — cardio + strength + leg + CNS load
- **Recovery score** — Oura readiness + sleep debt + HRV trend
- **Fueling score** — actual intake vs. maintenance estimate
- **Main limiter** — what's most limiting performance right now

### Nutrition coach
`vanguard-nutrition-coach` triangulates real maintenance from three sources — Oura TDEE (×0.88 correction factor), food logs, and 30-day weight trend — then computes a daily calorie/protein target accounting for training load and taper windows.

Goal: ~14% BF while sustaining marathon training. Target event: Košice Marathon, October 4 2026.

### Oracle (AI chat)
Every Oracle conversation is grounded in:

- 14 days of biometrics (HRV, sleep, nutrition, training)
- Evening reflections (P2-parsed: biggest cost, best move, blockers)
- 4 strongest behavioral patterns
- Active career projects and evidence
- Medical context (lab results, documents)
- Entity graph (people, projects — via embeddings)

Oracle never invents. It reads the evidence layer. The evidence layer never gets written by Oracle.

### Telegram bot
Primary interface. Not a fallback.

```
/koniec          — evening close, triggers reconciliation
/dieta           — nutrition status: target vs. today so far
/posilek [food]  — log a meal in natural language
/todo [task]     — add task with NL date parsing (+tomorrow, +5d)
/keep [note]     — save a note to Keep
```

Automatic messages: morning brief (Mon 6:00), evening questions (21:30 cron), Saturday check-in, weekly synthesis (Monday).

### Workout logger
Atomic save via RPC. Full session data:

- Exercises: name (autocomplete), sets, kg, reps, RIR, RPE
- Tags: muscle groups (back, chest, legs, shoulders, arms, core...)
- Special protocols: MSP (Max Strength Protocol)
- Cardio: type, duration, notes
- Session: name, start/stop timer, session RPE

### Career module
Not a todo list. A strategic record.

- `career_projects` — initiatives with thesis, leverage level, risk, sense status
- `career_moves` — individual actions with value type (leverage/stability/recovery) and work mode (deep/shallow/admin/recovery)
- `career_evidence` — proof that work happened, auto-created on move completion
- `career_decisions` — major decisions with expected effect, tradeoff, fear, verdict

---

## Edge functions

| Function | Purpose |
|---|---|
| `vanguard-oracle` | Main AI chat with full biometric + behavioral context |
| `vanguard-analyst` | 3am cross-module pattern analysis |
| `vanguard-nutrition-coach` | Daily calorie/protein target computation |
| `vanguard-daily-reconciliation` | Evening close: stream → reflective questions → planning summary |
| `vanguard-weekly-synthesis` | Monday digest of behavioral patterns |
| `compute-daily-strain` | Strain/recovery/fueling scoring |
| `sync-oura` / `sync-oura-enhanced` | Sleep, readiness, HRV, timeseries |
| `sync-strava` | Runs and rides |
| `sync-yazio` | Nutrition data |
| `sync-calendar` | Google Calendar events |
| `analyze-food-quality` | Meal quality scoring, MPS timing, micronutrient gaps |
| `analyze-training-load` | Volume trends, frequency, projection |
| `vanguard-auto-classify` | Stream event classification |
| `vanguard-todo-classify` | AI bucket assignment for tasks |
| `vanguard-graph-embedder` | Entity embeddings for Oracle context |
| `parse-food-nl` | Natural language food entry parsing |
| `lookup-food` | Food database search |

---

## Database

70+ tables. Key ones:

```
Daily tracking      oura_daily_summary, daily_strain, daily_nutrition,
                    daily_food_entries, daily_wins, daily_habits

Biometrics          oura_enhanced, oura_timeseries, body_metrics,
                    body_composition_measurements, exercise_logs,
                    workout_sessions, strava_activities

Nutrition           nutrition_profile, nutrition_targets, food_favorites

AI & stream         vanguard_stream, vanguard_behavioral_patterns,
                    friction_events, vanguard_oracle_runs,
                    vanguard_knowledge, vanguard_entity_links

Career              career_projects, career_moves, career_evidence,
                    career_decisions

Goals               life_goals, goal_kpis, kpi_entries, weekly_reviews,
                    weekly_kpi_reviews, dreams, vision_board_items
```

---

## Core guardrails

1. **Evidence and reasoning are separate layers.** Oracle reads evidence. It never writes it.
2. **Friction writes go through one path.** `vanguard_stream → vanguard-auto-classify`. No shortcuts.
3. **Patterns need evidence.** Count, confidence, date range. No invented claims.
4. **Missing data stays missing.** Never backfilled, never assumed.
5. **LLM output cannot mutate the evidence layer** without explicit user confirmation.
6. **Timezone is Europe/Warsaw at the DB level.** Always `(now() AT TIME ZONE 'Europe/Warsaw')::date::text`. Never `current_date::text`.

---

## Getting started

```bash
git clone https://github.com/jcob2276/vanguard-os
cd vanguard-os
npm install
cp .env.example .env
# fill in Supabase URL, anon key, service role key
npm run dev
```

For edge functions:
```bash
supabase functions serve vanguard-oracle --env-file .env.local
```

Full setup: [docs/DEV_GUIDE.md](docs/DEV_GUIDE.md)

---

## Status

Active. Built solo, daily, for ~3 months.

This is a personal system built for one person's specific context: marathon training, body composition, career portfolio, daily execution. It is not a generic productivity app and it is not designed to be. Every architectural decision reflects a specific constraint or behavioral pattern from actual daily use.

If you're building something similar — a personal OS, a life data layer, a self-tracking system with real AI reasoning — the code is here and the patterns are real.

---

## Inspired by

[Memex](https://memexlab.ai) — incredible work on the timeline card model and insight philosophy. Different stack (Flutter, local-first) but the same core belief: life data deserves better than a dashboard.

---

## License

MIT
