# Vanguard OS — Backlog

Rzeczy do zrobienia DOPIERO po Sprint 1 (repeated_pattern_candidates).
Nie implementować wcześniej.

**WYJĄTEK — mini-patch przed Sprint 1 jeśli spełniony warunek (patrz BACKLOG-01a).**

---

## Known bugs (fix anytime — nie czekać na Sprint 1)

### [BUG-01] `tomorrowWarsawDate` — UTC offset w `vanguard-telegram`

**Lokalizacja:** `supabase/functions/vanguard-telegram/index.ts` ~503–507

**Problem:** `d.setDate(d.getDate() + 1)` działa w UTC (runtime Supabase), dopiero potem formatuje przez `Europe/Warsaw`. W okolicach północy plan może dostać złą `target_date` w `planning_summary`.

**Wzorzec poprawny:** jak w `vanguard-morning-brief` — liczyć „dziś” w Warsaw, potem dodać 1 dzień kalendarzowy w tej strefie (bez `setDate` na obiekcie UTC).

**Objaw:** poranny brief nie znajduje planu / plan przypisany do złej daty.

---

### [BUG-02] `vanguard-daily-reconciliation` guard — fałszywy skip wieczorem

**Lokalizacja:** `supabase/functions/vanguard-daily-reconciliation/index.ts` ~42–51

**Problem:** Guard sprawdza tylko `date = today` — jeśli jakikolwiek wpis na dziś już istnieje (np. ślad po porannym/midday flow na tej samej dacie), cron pomija wysyłkę wieczornej reconciliation.

**Fix kierunkowy:** skip tylko gdy wieczorna reconciliation już poszła (`status = 'sent'` + `telegram_message_id`), nie przy samym istnieniu wiersza z dzisiejszą datą.

**Objaw:** brak wieczornego „Daily reconciliation” mimo że dzień nie był domknięty.

---

## [BACKLOG-01] Rozróżnienie typów obserwacji

**Kontekst:** W QA z 2026-05-17 pojawiły się dwa false positives w friction_events:
- wpis o bólu brzucha przed weselem (stan, nie odchylenie)
- wpis o niepatrzeniu w oczy (zaobserwowane zachowanie, brak intencji)

Oba zostały oznaczone `review_status = 'to_fix'` i nie psują precision friction_events.

**Docelowy podział (nie budować jeszcze jako osobne tabele):**

1. `friction_event` — jest intencja / odchylenie / zachowanie
   - przykład: "chciałem poprosić do tańca, ale się zawahałem"
   - wymaga: konkretny moment + deviation

2. `state_observation` — stan bez odchylenia
   - przykład: "jadę na wesele, boli mnie brzuch, stresuję się"
   - wartościowe jako kontekst biometryczny / emocjonalny

3. `micro_behavior_observation` — zaobserwowane zachowanie bez jawnej intencji
   - przykład: "zauważyłem, że nie patrzę w oczy podczas mówienia"
   - wartościowe jako pattern seed, ale nie friction event

**Opcje implementacji (do decyzji po Sprint 1):**
- Nowa kolumna `event_type` w friction_events: 'friction' | 'state' | 'micro_behavior'
- Osobna tabela `vanguard_observations`
- Prompt update w auto-classify żeby lepiej rozróżniał

**Nie kasować tych obserwacji ze streamu** — są materiałem do reprocessingu.

---

## [BACKLOG-02] StayFree sync stale — brak automatycznego ingestion

**Kontekst:** StayFree ma dane starsze o 10 dni (ostatni rekord 2026-05-07).
`stayfree_usage` zawiera per-app rows (duration_seconds, unlocks, launches) ale nie ma pre-computed scores.
`dopamine_load_index` i `screen_time_min` w `vanguard_daily_aggregates` są NULL od kiedy StayFree nie syncuje.

**Dlaczego ważne:**
- screen time → `self_control_break` (late night phone)
- dopamine_load_index → kontekst dla `sleep_disruption`
- fragmentation_index → rozproszenie uwagi

**Nie blokuje Observation Mode.** Friction events zbierają się bez tego.

**Do zrobienia (po Sprint 1):**
- Zidentyfikować jak StayFree wchodzi do bazy (brak edge function — prawdopodobnie manual upload lub bridge script)
- Zautomatyzować ingestion
- Podpiąć screen_time pod friction pipeline (late_night_screen → sleep_disruption)

---

## [BACKLOG-03] Oura timing — sleep_data_status: pending

**Kontekst:** Oura synchronizuje sen po wstaniu (rano), ale briefing odpala się o 04:00 UTC (06:00 Warsaw).
Jeśli Oura nie zdążyła zsynchronizować przed briefingiem, briefing może używać danych z poprzedniego dnia.

**Docelowe zachowanie:**
- Jeśli Oura data dla dzisiejszego dnia nie istnieje w momencie briefingu → `sleep_data_status: pending`
- Briefing nie wnioskuje o aktualnym śnie
- Ewentualnie: drugi mini-update po syncu Oura (19:00 cron)

**Nie blokuje Observation Mode.** Freshness guard w briefingu częściowo obsługuje ten przypadek przez stale detection.

**Do zrobienia (przed lub równolegle ze Sprint 1).**

## [BACKLOG-01a] Trigger: mini-patch event_kind przed Sprint 1

**Warunek wyzwalający (sprawdzić po kolejnych ~20 wpisach):**
Jeśli ≥3 kolejne `to_fix` wynikają z:
- `self_control_break` bez konkretnego momentu/intencji
- `communication_drift` bez konkretnego momentu/intencji
- obserwacji o sobie bez deviation

→ wykonać mini-patch PRZED Sprint 1.

**Co zrobić w mini-patchu:**
Dodać kolumnę `event_kind` do `friction_events`:
- `friction_event` — konkretne tarcie z momentem i deviation
- `positive_micro_action` — dobry mikrogest
- `state_observation` — stan emocjonalny / fizyczny bez odchylenia
- `micro_behavior_observation` — zaobserwowane zachowanie bez jawnej intencji
- `reflection` — refleksja / generalizacja / wniosek

Precision liczony tylko po `event_kind IN ('friction_event', 'positive_micro_action')`.

**Aktualny stan (2026-05-17):** 4x `to_fix` z 12 eventów = 2 z ontologii, 2 z braku momentu.
Jeszcze nie spełnia progu 3 kolejnych. Monitorować.

**Nie implementować dopóki warunek nie jest spełniony.**
