# Vanguard OS — Backlog

Rzeczy do zrobienia **po Sprint 1** (`repeated_pattern_candidates`), chyba że sekcja mówi inaczej.

**Przed kodem:** `AGENTS.md` → `docs/ARCHITECTURE.md` → `supabase/functions/README.md`  

---

## Done (fixed — tylko archiwum)

| ID | Fix | Kiedy |
|----|-----|-------|
| BUG-01 | `tomorrowWarsawDate` — data z `activePlanning.date + 1` zamiast UTC `setDate` | 2026-05-23 (f1bb2b6) |
| BUG-02 | `vanguard-daily-reconciliation` — guard wieczorny z cutoff 17:00 Warsaw | 2026-05-23 (f1bb2b6) |
| Clarity-02 | `vanguard-architect` — usunięty martwy `extractFrictionEvent` | 2026-05-26 |

---

## Known bugs (fix anytime)

*(pusto — nowe bugi dopisuj tutaj, nie w strikethrough w treści)*

---

## [BACKLOG-01] Rozróżnienie typów obserwacji

**Kontekst:** W QA z 2026-05-17 pojawiły się dwa false positives w friction_events:
- wpis o bólu brzucha przed weselem (stan, nie odchylenie)
- wpis o niepatrzeniu w oczy (zaobserwowane zachowanie, brak intencji)

Oba zostały oznaczone `review_status = 'to_fix'` i nie psują precision friction_events.

**Docelowy podział (nie budować jeszcze jako osobne tabele):**

1. `friction_event` — jest intencja / odchylenie / zachowanie
2. `state_observation` — stan bez odchylenia
3. `micro_behavior_observation` — zaobserwowane zachowanie bez jawnej intencji

**Stan na 2026-06 (po wdrożeniu):**
- Kolumna `event_kind` + pełna taksonomia wdrożona (mig. 20260525 + 20260528).
- Prompt w auto-classify zawiera wyraźne rozróżnienie + przykłady (w tym te z backlogu).
- `confirmed_friction_events` VIEW + wszystkie core consumery (reconciliation, analyst, weekly-synthesis, Oracle) filtrują wyłącznie `friction_event` + `positive_micro_action`.
- `friction-qa` został wyłączony jako cykliczny/telegramowy raport; przyszły QA powinien być SQL/dashboard, nie bot.
- Dodatkowe zaostrzenie reguł w promptcie (czerwiec 2026) po rewizji BACKLOG-01.

**Aktualny tryb:** monitorowanie precision + okazjonalne ostrzenie promptu przy powtarzających się błędach w QA.

**Nie kasować obserwacji innych typów ze streamu** — cenny materiał do późniejszej analizy wzorców.

---

## [BACKLOG-02] StayFree sync stale — brak automatycznego ingestion

**Kontekst:** StayFree ma dane starsze o 10 dni (ostatni rekord 2026-05-07).  
`dopamine_load_index` / `screen_time_min` w `vanguard_daily_aggregates` mogą być NULL.

**Do zrobienia (po Sprint 1):** zautomatyzować ingestion, podpiąć pod friction pipeline.

---

## [BACKLOG-03] Oura timing — sleep_data_status: pending

**Kontekst:** Briefing przed sync Oura może używać wczorajszego snu.

**Stan na 2026-06:** Było wdrożone w `vanguard-morning-brief`; morning brief jest obecnie deprecated stubem.
- Dodano jawne sprawdzenie najnowszego rekordu z `oura_daily_summary`.
- Gdy data najnowszego wpisu != dzisiejsza data warszawska → w briefie pojawia się:
  > Sen z ostatniej nocy (Oura): pending — dane jeszcze nie zsynchronizowane

Interaktywny kontekst (Oracle via Telegram) już wcześniej miał podobny flag (`sleep_data_status` w state_vector).

Automatyczny StayFree nie jest priorytetem (użytkownik wrzuca ręcznie).

---

## [BACKLOG-01a] Trigger: mini-patch event_kind (zarchiwizowane)

**Pierwotny warunek:** ≥3 kolejne `to_fix` z tego samego powodu.

**Stan na czerwiec 2026:** Podstawowa taksonomia została wdrożona proaktywnie (nawet bez spełnienia progu). `vanguard-friction-qa` jako raport Telegram został wyłączony; dalsze poprawki promptu powinny opierać się o SQL/dashboard.

Wpis pozostawiony dla historii. Nie wymaga już aktywnego monitoringu jako osobny backlog item.
