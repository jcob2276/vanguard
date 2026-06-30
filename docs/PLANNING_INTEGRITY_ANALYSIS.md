# Planning System — Integrity Analysis

**Date:** 2026-06-30 (post-cleanup)
**Status:** ✅ Clean

---

## What passed (no issues)

| Check | Result |
|-------|--------|
| Lint (src/) | 0 errors |
| TypeScript | 0 errors |
| Tests | 65/65 passed |
| Dead table references (TS) | 0 found — all dropped tables removed from code and edge functions |
| Stale FK references | 0 found — no code references career_*, focus_sessions, daily_plan, weekly_kpi_reviews |
| Type safety | GoalSpine, SprintContext, MonthlySpineSlice all properly typed and consistent with DB schema |
| Cache invalidation | Every write path calls invalidateGoalSpineCache() |
| RLS policies | All planning tables have owner-only policies |
| UNIQUE constraints | weekly_reviews(user_id, week_start), sprint_goals(user_id, personal_year, sprint_number), sprint_reviews(user_id, personal_year, sprint_number), monthly_reviews(user_id, month_start) |

---

## Data flow — verified end-to-end

```
BHAG (life_goals)
  └─ Sprint goal (sprint_goals.goal_text + focus_project_ids)
       └─ Month review (monthly_reviews: pattern, leverage, correction, theme)
            └─ Week plan (weekly_reviews: intention, commitment, cialo/duch/konto)
                 └─ Day wins (daily_wins: task_1..5 + done_1..5)
                      └─ KPI rollup (kpi_entries via increment_kpi_entry_for_week)
```

### Bridges verified:

| Bridge | Function | Guard |
|--------|----------|-------|
| Month → Week | `monthCarryToWeekPlan()` + `applyMonthCarry()` in Direction.tsx | Only prefills when target fields are empty |
| Sprint → Project | `completeSprintClose()` → `saveSprintGoal(focusProjectIds)` | continue/defer decision → paused status for deferred |
| Week reflection guard | `saveWeeklyReviewReflection()` | `if (weekStart > currentWeekStart()) throw` — future-week blocked |
| Month hard gate | `isMonthlyHardGate()` | Days 1-7 block week/week planning |
| Sprint closing | `isSprintClosingWeek()` | weekInSprint === 12 triggers sprint close UI |

---

## KPI rollup — improved

Previous: blocked when project had >1 KPI (`projectKpis.length !== 1`).
Current: `pickRollupKpi()` at goalSpine.ts:845 resolves by:
1. Explicit `preferredKpiId` if set
2. Single KPI → auto
3. Multiple KPIs → pick highest-target KPI
4. Fallback → first KPI

---

## One remaining known gap (not a bug, a design choice)

**KPI rollup auto-delegation is implicit.** When a project has multiple KPIs and none is explicitly preferred, the system picks the highest-target one silently. No user-facing indicator shows which KPI receives auto-rollup. This is acceptable for now but may need a UI signal if KPI count per project grows beyond 2-3.

---

## Summary

System is clean. No duplications, no dead references, no type mismatches. The planning hierarchy (BHAG → sprint → month → week → day) is structurally complete with proper guards at each transition.
