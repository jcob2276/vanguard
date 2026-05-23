# AI CONTEXT: KUBA WORKOUT APP (GRANDE FINALE 2.1)

## 1. PROJECT OVERVIEW
This is a high-performance, **brutalist-styled** tracking application designed for a 16-week transformation program. It combines physical training, nutritional management, physiological recovery tracking (Oura), and mental discipline (Power List).

- **Version:** 2.1 "Grande Finale"
- **Target:** 100 kg Bench Press and 16-week transformation completion.
- **Philosophy:** Efficiency, Data-driven discipline, Brutalist UI (high contrast, bold typography, functional).

---

## 2. TECH STACK
- **Frontend Framework:** React 19 (Functional Components, Hooks).
- **Build Tool:** Vite 8.
- **Styling:** Tailwind CSS 4 (using `@tailwindcss/postcss`).
- **State Management:** Zustand (Global store in `src/store/useStore.js`).
- **Routing:** React Router 7.
- **Backend/Database:** Supabase (PostgreSQL, Auth, Edge Functions).
- **Icons:** Lucide-react.
- **Date Utilities:** date-fns (Polish locale used extensively).
- **Visualizations:** Recharts (for stats and progress).
- **PWA:** Enabled via `vite-plugin-pwa`.

---

## 3. CORE MODULES & DOMAIN LOGIC

### 🏋️ TRAINING (Workout Management)
- **Schedule:** 4 days/week (A, B, C, D).
    - **A:** Heavy Upper (Strength + Lats + Triceps)
    - **B:** Back + Shoulders + RDL
    - **C:** Legs + APT + Core
    - **D:** Light Upper + Arms + Core
- **Key Metric - MSP (Mimowolnie Spowolnione Powtórzenia):** 
    - Rating scale 0, 1, 2 representing involuntary slowing down in the last reps.
    - Used to decide progressive overload (Add weight vs. Stay vs. Deload).
- **Bench Press Progression:** Specific 16-week path targeting 100kg (defined in `src/data/workoutPlan.js`).
- **Data Persistence:** 
    - Local draft storage in `localStorage` (`workout_draft_${dayKey}`) to prevent data loss.
    - Final logs synced to Supabase `workout_sessions` and `exercise_logs`.
- **Validation:** Safeguard against swapped weight/reps for compound lifts.

### 🧭 POWER LIST (Kierunek)
- **Daily Rules:** 
    - Exactly **5 tasks** per day.
    - Categories: **Ciało** (Body), **Duch** (Spirit), **Konto** (Finance/Business).
    - Result: **Z (Win)** if 5/5 tasks completed. **P (Loss)** if < 5/5.
    - Deadline: Unfinished days are auto-marked as 'P' at 23:00.
    - Planning: Users are encouraged to plan the next day in advance.
- **Hierarchy:**
    - **Weekly Win:** Max 2 losses (P) per 7 days.
    - **Monthly Win:** Min 3 winning weeks per month.
- **Life Goals:** Long-term targets for Ciało, Duch, Konto with countdown timers.

### 📓 JOURNALING & HABITS
- **Daily Journal:** Mood score (1-5), Gratitude entry, Daily reflections.
- **Weekly Review:** Sunday-only reflection prompts ("Proud of", "Sabotage", "Improvements"). Locked after submission.
- **Habits:** Custom habits with 30-day heatmap visualization. Support for positive (to do) and negative (to avoid) habits.

### 🥗 NUTRITION (Yazio Integration)
- **Weekly Budget:** 12,600 kcal total (average 1800/day).
- **Protein Target:** 150g daily.
- **Data Source:** Synced from Yazio via Supabase Edge Functions into `daily_nutrition` and `daily_food_entries`.

### 💍 OURA INTEGRATION
- **Data:** Readiness, Sleep, Activity.
- **Sync:** Nightly automated sync via Edge Functions.

---

## 4. DATABASE SCHEMA (SUPABASE)
Key tables found in `schema.sql`:
- `workout_sessions`: Metadata for training sessions.
- `exercise_logs`: Individual set data (weight, reps, rpe/msp).
- `daily_wins`: Power List tasks, completion status, and journaling data.
- `weekly_reviews`: Sunday reflections.
- `habits` & `habit_logs`: Habit definitions and daily tracking.
- `user_settings`: User-specific config (Yazio/Oura tokens, etc.).
- `life_goals`: Long-term context.

---

## 5. UI/UX & DESIGN SYSTEM
- **Theme:** Brutalist Dark Mode.
- **Colors:**
    - Background: `#000000` (Pure Black)
    - Primary: `#3b82f6` (Blue-500)
    - Win/Success: `#22c55e` (Green-500)
    - Loss/Alert: `#ef4444` (Red-500)
    - Accent colors for days: Day A (Blue), Day B (Amber), Day C (Emerald), Day D (Purple).
- **Typography:** Uppercase headers, font-black, font-italic for emphasis. High contrast.
- **Components:** Interactive "cards" with haptic-style feedback, animated progress bars, and minimal borders.

---

## 6. CODING CONVENTIONS
1. **State Management:** Use `useStore.js` (Zustand) for global app state (session, settings).
2. **Components:** Functional components with Tailwind CSS for all styling.
3. **Data Fetching:** Direct Supabase client usage in components or store.
4. **Dates:** Always use `date-fns` for formatting and calculations to ensure consistency.
5. **Logic:** Keep business logic (like winning/losing calculation) inside components or dedicated utility functions.
6. **Persistence:** Prioritize `localStorage` for drafts and Supabase for permanent storage.

---

## 7. CRITICAL RULES FOR AI ASSISTANTS
- **Maintain Brutalism:** Do not introduce "soft" or "rounded" UI elements unless requested. Stick to high-contrast, bold, uppercase styles.
- **Respect Logic:** The 5-task rule and MSP logic are core to the application. Do not modify these without explicit instruction.
- **Localization:** Use Polish for UI text (labels, prompts) but keep code and technical documentation in English.
- **Security:** Always use `user_id` from the session when querying/updating data in Supabase.
