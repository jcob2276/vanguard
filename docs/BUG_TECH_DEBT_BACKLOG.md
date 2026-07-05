# Vanguard OS — Bug & Tech Debt Backlog

Zebrane z audytu 2026-07-05 (agentowy sweep: god-files, write-orphan tables, silent-fail writes, helper bypass, offline resilience, AI client dedup). Checklist do odhaczania — nie plan, nie research, tylko lista konkretnych rzeczy do zrobienia.

---

## ✅ Naprawione w sesji 2026-07-05

- [x] `DailyShutdownModal.tsx` — `daily_wins` przez `updateDailyWin()` (cache invalidation) + 3 zapisy sprawdzają `error`
- [x] `MorningPlanModal.tsx` `handleYesterdayAction` — 5 zapisów sprawdza `error` + revert optymistycznego UI
- [x] `calendarHelpers.ts` `todayStr()` — `getTodayWarsaw()` zamiast lokalnej strefy przeglądarki
- [x] `vanguard-eval-runner`, `photoLabel.ts` — przepięte na wspólny `openaiChat()` (`_shared/openai.ts`)
- [x] Offline queue (`src/lib/offlineQueue.ts`) — trening (`saveWorkoutSession`) + posiłek (4 miejsca w `useFoodEntryData.ts`)

---

## 🔴 Priorytet 1 — silent-fail na aktywnie używanych funkcjach

- [ ] `InsightsDashboard.tsx:63-82` — brak `try/catch` w ogóle (pin/sort/delete); optymistyczne usunięcie karty mimo nieudanego DB delete → wraca po odświeżeniu bez wyjaśnienia. **Realna utrata danych.**
- [ ] `GrowthView.tsx:230-234` `handleDonePin` — główny zapis sprawdzony, ale 2 zapisy kaskadowe (`vanguard_links`, `todo_items`) nie
- [ ] `PatternCard.tsx:38-47` — `update()` niesprawdzony, feedback UI odpala się mimo to

## 🟠 Priorytet 2 — write-orphany wymagające decyzji (dobuduj zapis albo usuń martwy odczyt)

- [ ] `endmyopia_daily_logs` — czyta `VisionJournal.tsx`, zero writera (związane z optics)
- [ ] `user_fundament` — `IdentityVault.handleSave()` woła `ingest-vault-log`, niepotwierdzone czy ta funkcja faktycznie zapisuje tabelę
- [ ] `nutrition_profile` — 8 miejsc czyta, zero insert/update/upsert nigdzie
- [ ] `location_history` — czyta `exportStats.ts`, zero writera
- [ ] `medical_documents`, `medical_lab_results` — tylko jednorazowy seed, brak ścieżki dodania nowych wyników
- [ ] `training_plan_workouts` — brak ścieżki edycji planu
- [ ] `user_portions` — RLS gotowe pod zapis LLM, zero wywołania insert/update — funkcja zaprojektowana, nigdy niedopięta
- [ ] `morning_briefs` — całkowicie martwa (ani czytana, ani zapisywana, brak nawet migracji)
- [ ] `vanguard_entity_aliases` — martwa, porzucona funkcja resolwera encji z grafu wiedzy

## 🟡 Priorytet 3 — ominięte kanoniczne helpery

- [ ] `todo_items` — surowe zapisy poza `lib/todo.ts`: `checkpoints.ts:85`, `projects.ts:119-183` (3 miejsca), `GrowthView.tsx:233`, `MorningPlanModal.tsx:396-397`, + 3 edge functions (`vanguard-telegram`, `vanguard-push-reminder`, `vanguard-todo-classify`)
- [ ] `kpi_entries` — `Projects.tsx:386-391` (`handleUpdateKpiValue`) omija RPC `increment_kpi_entry_for_week`; `KpiTrendSparkline.tsx:76-90` fallback liczy `+1` z lokalnego stanu (stale-read risk tylko gdy RPC padnie)

## 🟢 Priorytet 4 — duplikaty logiki daty/timezone

- [ ] `useGrowthData.ts:281` — `todayStr = weekStart` (mylące), psuje liczenie "dni po terminie" przy oglądaniu innego tygodnia
- [ ] `AddPrescriptionModal.tsx:19` — surowy `new Date().toISOString().split('T')[0]`
- [ ] `fitnessScore.ts:307` — niska pewność, wymaga doczytania
- [ ] `LeniePanelMini.tsx:20` — poprawna logika, tylko zduplikowana (code smell, nieszkodliwe)

## 🔵 Priorytet 5 — struktura kodu (god-files, Tier 1 w trakcie)

- [ ] **Tier 1:** `CalendarView.tsx` (1922 linii), `Dashboard.tsx` (907), `Direction.tsx` (806) — *w trakcie*
- [ ] **Tier 2:** `TodoCard.tsx`, `RichEditor.tsx`, `Keep.tsx`, `Projects.tsx`, `exportStats.ts`, `MorningPlanModal.tsx`, `Todo.tsx`, `LinksInbox.tsx`, `usePowerListData.ts`
- [ ] **Tier 3:** `FitnessScorePanel.tsx`, `OracleCard.tsx`, `FoodEntryModal.tsx`, `useDirectionContext.ts`, `ProjectCard.tsx`, `GrowthView.tsx`

## ⚪ Priorytet 6 — inne, mniej pilne

- [ ] Test coverage edge functions: 4 pliki testowe na ~30 funkcji (w `src/` jest 12 na całą apkę)
- [ ] CI (`ci.yml`) łapie dryf migracji DB, ale nie dryf **wdrożonego kodu funkcji** vs repo (dokładnie ten incydent co `vanguard-detect-patterns`/`get_brain_health_report`)
- [ ] 89× `as any` w `src/` — część to świadomy dług (post-migracja przed `gen types`), część zjada realne bugi (magic-string column access typu `winData[\`task_${i}\`]`)
- [ ] Offline queue pokrywa na razie tylko trening + posiłek — notatki/todo/nawyki wciąż rzucą błąd offline
- [ ] Architektura `task_1..task_5` / `done_1..done_5` w `daily_wins` — sztywne sloty zamiast tabeli podrzędnej (nie ruszać bez wyraźnej potrzeby, tylko świadomość)
- [ ] Nie zrobiono: pełny audyt RLS na 100 tabelach, wydajność zapytań/indeksów, bundle size frontendu

---

**Jak z tym pracować:** odhaczaj `[x]` po każdym zamkniętym punkcie, dopisuj nowe na dole właściwego priorytetu. Priorytet 1-3 = bugi (realne ryzyko dla danych/UX), priorytet 4-6 = dług techniczny (nie pali się).
