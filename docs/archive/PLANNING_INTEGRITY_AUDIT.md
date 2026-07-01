# Planning System Integrity Audit

**Data:** 2026-06-30
**Scope:** Full codebase scan — tables, columns, functions, duplicate logic, dead code

---

## 1. Martwe tabele (0 referencji w kodzie TS)

| Tabela | Migracja | Uwagi |
|---|---|---|
| `career_projects` | 20260613130000 | Cały moduł career — 4 tabele, zero UI/backend |
| `career_moves` | 20260613130000 | j.w. |
| `career_evidence` | 20260613130000 | j.w. |
| `career_decisions` | 20260613130000 | j.w. |
| `vanguard_repeated_patterns` | 20260525171000 | Nadpisany przez vanguard_behavioral_patterns (20260602) |
| `vanguard_known_persons` | 20260525171000 | Zero odwołań — stare oracle tables |
| `vanguard_singleton_relations` | 20260514000009 | Zero odwołań — graph v1, zastąpiony przez entity_links |
| `vanguard_correlations` | 20260531000001 | Nowy system correlation w _shared/correlationEngine |
| `vanguard_temporal_links` | 20260531000001 | Zero odwołań |
| `vision_board_items` | 20260616133000 | Zero odwołań — nigdy nie podpięty do UI |
| `vanguard_pattern_feedback` | 20260623220000 | Zero odwołań |
| `vanguard_wiki_review_items` | 20260612123000 | Tylko vanguard-wiki-compiler pisze, nikt nie czyta z TS |
| `focus_sessions` | 20260623250000 | Zero odwołań — zbudowane z daily_plan v2, ten sam los |

**Łącznie: 13 martwych tabel** (11 zanim applied, 2 już usunięte w nowych migracjach)

---

## 2. Zduplikowane komponenty UI

`Divider`, `StatCard`, `Textarea` — zaimplementowane 3× w:
- `src/components/lifestyle/DirectionPlanningMode.tsx`
- `src/components/lifestyle/DirectionMonthlyMode.tsx`
- `src/components/lifestyle/DirectionSprintMode.tsx`

**Fix:** Wydzielić do `src/components/lifestyle/shared/ReviewCard.tsx`

---

## 3. Zduplikowane utilitari date/week

| Utilita A | Utilita B | Różnica |
|---|---|---|
| `daysBefore(n)` — desktopUtils.ts:23 | `getDaysAgoWarsaw(n)` — date.ts:14 | Identyczna logika, różne importy |
| `DOW_PL` — desktopUtils.ts:82 (module-level) | `DOW_PL_LOCAL` — desktopUtils.ts:388 (wewnątrz computeLenieInsight) | Ta sama tablica, definicja lokalna niepotrzebna |
| `getPastWeekStarts()` — date.ts:82 | `shiftWeekStart()` — growth.ts:119 | Ręczna pętla vs date-fns addWeeks |
| `monthThemeSourceForWeek()` — vanguard-week-recap:20 | `monthThemeSourceForWeek()` — monthReview.ts:65 | Duplikat w edge function |

---

## 4. Nieużywane eksporty

| Plik | Eksport | Importerów |
|---|---|---|
| `goalSpine.ts` | `saveMonthlyReviewDraft` | 0 |
| `goalSpine.ts` | `setKpiValueForWeek` | 0 |
| `goalSpine.ts` | `fetchLatestWeeklyReview` | 0 (tylko wewnętrznie) |
| `lifeGoals.ts` | `projectPillar` | 0 (Projects.tsx definiuje własny local) |
| `lifeGoals.ts` | `LIFE_GOAL_PILLARS` | 0 |
| `date.ts` | `getPastWeekStarts` | 0 zewnętrznych |
| `planAdherence.ts` | cały plik | 0 importów |
| `goalSpineGuide.ts` | `formatSprintWeekBridge` | 0 |

---

## 5. Martwe kolumny (istnieją w schema, zero read/write)

| Tabela | Kolumna | Uwagi |
|---|---|---|
| `daily_wins` | `result` | Czytane w sprintReview.ts, monthReview.ts, ale nie jest planowane — tylko raportowane |
| `weekly_reviews` | `week_focus` | Zero odwołań w kodzie |
| `weekly_reviews` | `week_sentiment` | Zero odwołań w kodzie |
| `weekly_reviews` | `embedding` | Zero odwołań |
| `weekly_reviews` | `importance_score` | Zero odwołań |
| `daily_reconciliations` | `analysis_without_deployment` | Zero odwołań |
| `daily_reconciliations` | `compression_mode_used` | Zero odwołań |

---

## 6. Istniejące tabele z marginalnym wykorzystaniem

| Tabela | Gdzie użyta | Ryzyko |
|---|---|---|
| `vanguard_iron_rules` | Tylko vanguard-oracle (1 read) | Może być dead — oracle sam generuje reguły |
| `vanguard_entity_aliases` | Tylko ingest-vault-log (1 write) | Nigdy nie czytana w UI |
| `vanguard_wiki_sources` | Tylko vanguard-wiki-compiler (1 write) | Nigdy nie czytana poza kompilacją |
| `oracle_pending_actions` | Tylko vanguard-oracle (1 write) | Zero read w UI/TS |
| `knowledge_insight_cards` | Tylko vanguard-oracle (3 ops) | Zero read w UI/TS |

---

## 7. Hierarchia planowania — aktualna

```
BHAG (life_goals) — brak guidance gate w spnie, brak mostu w dół
  └─ Sprint (12w) — sprint_goals.focus_project_ids (nowe), strukturalny link do projektów
       └─ Miesiąc — monthly_reviews (nowe), hard gate 7 dni, soft cue 14 dni
            └─ Tydzień — weekly_reviews (plan + reflection w jednej tabeli)
                 └─ Dzień — daily_wins (task_1..5, done_1..5)
```

### Braki w Mostach

| Z | Do | Most | Status |
|---|---|---|---|
| BHAG | Sprint | `longTermBridge.formatSprintWeekBridge()` | Tekst tylko, zero UI w momencie ustawiania celu |
| Sprint | Tydzień | `formatSprintWeekBridge()` w goalSpine | Export nieimportowany nigdzie |
| Miesiąc | Tydzień | `monthCarryToWeekPlan()` | Carry na intention + najsłabszy filar, brak correction/leverage |
| Tydzień | Dzień | `dailyPlanProposal.ts` | Istnieje, ale brak FK — generated columns dopiero added |

---

## 8. Rekomendowane czyszczenie (kolejność)

### P0 — Martwe tabele (DROP)
1. `career_projects`, `career_moves`, `career_evidence`, `career_decisions`
2. `vanguard_repeated_patterns`, `vanguard_known_persons`
3. `vanguard_singleton_relations`, `vanguard_correlations`, `vanguard_temporal_links`
4. `vision_board_items`, `vanguard_pattern_feedback`, `focus_sessions`

### P1 — Zduplikowane utilitari
1. Usunąć `daysBefore()` z desktopUtils — używać `getDaysAgoWarsaw()` z date.ts
2. Usunąć `DOW_PL_LOCAL` z computeLenieInsight — używać modułowego `DOW_PL`
3. Usunąć `getPastWeekStarts()` z date.ts — używać `shiftWeekStart()`
4. Wydzielić `Divider`, `StatCard`, `Textarea` do shared komponentu

### P2 — Nieużywane eksporty
1. Usunąć `saveMonthlyReviewDraft`, `setKpiValueForWeek`, `fetchLatestWeeklyReview` z goalSpine
2. Usunąć `projectPillar`, `LIFE_GOAL_PILLARS` z lifeGoals
3. Usunąć `getPastWeekStarts` z date.ts
4. Usunąć `formatSprintWeekBridge` z goalSpine (zastąpić przez direct usage)
5. Usunąć `planAdherence.ts` jeśli zero importów

### P3 — Martwe kolumny (ALTER TABLE DROP)
1. `weekly_reviews.week_focus`, `week_sentiment`, `embedding`, `importance_score`
2. `daily_reconciliations.analysis_without_deployment`, `compression_mode_used`

### P4 — Mosty strukturalne
1. Sprint goal ↔ BHAG UI bridge (pokazuj BHAG przy ustawianiu celu sprintu)
2. Month carry → week: dodać `pillar_delta_targets` propozycję w UI
3. KPI auto_rollup flag na `goal_kpis`

---

## 9. Ocena po cleanup

| Metryka | Przed | Po (projekcja) |
|---|---|---|
| Martwe tabele | 13 | 0 |
| Zduplikowane helpers | 3 komponenty × 3 | 1 shared |
| Nieużywane eksporty | 8 | 0 |
| Martwe kolumny | 6 | 0 |
| Mosty guidance | 1 (month→week) | 4 (full chain) |
