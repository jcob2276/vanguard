# ETAP 1 – Research: Jakie wzorce da się już TERAZ wykryć z istniejących danych

**Data researchu:** czerwiec 2026  
**Cel:** Zidentyfikować konkretne, realnie wykrywalne wzorce behawioralne na podstawie aktualnego stanu danych (po wszystkich upgrade'ach friction + p2_parsed + aggregates z 2026-05).  
**Metoda:** Analiza kodu (auto-classify, reconciliation, save-daily-aggregate, vanguardCore, weekly-synthesis, oracle, morning-brief, planning) + migracji schematu + istniejących agregacji.

---

## 1. Źródła danych – aktualna siła sygnału (czerwiec 2026)

| Źródło                        | Głębokość sygnału                              | Gotowość do wzorców | Główne ograniczenia |
|-------------------------------|------------------------------------------------|---------------------|---------------------|
| **friction_events** (po mig 20260528 + 300001) | Bardzo wysoka. Pełny event_kind + declared_intention/actual_behavior/deviation + extraction_quality + status | Wysoka | Większość rekordów ma status='raw' lub 'weak_extraction'. Brak masowego "confirmed". Brak user feedback na friction. |
| **p2_parsed** (daily_reconciliations) | Wysoka (użytkownik własnymi słowami: biggest_cost, best_move, blocker_candidates, day_score, resource, correction) | Wysoka | Zależna od jakości voice note + parse_confidence. Często needs_manual_review. |
| **operational_facts** (evening_extraction + kolumny) | Średnia/wysoka (first_90_protected, phone_first, tension_action_result, artifact, analysis_substitution) | Średnia | Legacy extractor, słabo czytany poza reconciliation. |
| **planning_summary** (daily_reconciliations) | Wysoka strukturalnie (production_artifact, tension_action, minimum_viable_day, morning_activation itd.) | Wysoka | Często "minimum" lub rescue. Brak bezpośredniego pola "plan_adherence_score". |
| **vanguard_daily_aggregates** | Bardzo wysoka (execution_score, identity_score, final_state, sleep, hrv, rhr, dopamine_load, fragmentation, screen_time, strava, protein) + personal z-score baseline | Bardzo wysoka | Najlepsze źródło do korelacji. VanguardCore już liczy baseline 90d. |
| **vanguard_stream** | Średnia (content + category, tags, importance, situation_fingerprint, bitemporal valid_from/until) | Średnia | Dużo szumu. Closure proposals działają. |
| **oura_daily_summary + stayfree + nutrition + wins** | Wysoka (przez aggregates) | Wysoka | Oura timing (BACKLOG-03) – dane "pending" często. |
| **vanguard_correlations + vanguard_temporal_links** | Dropped 2026-06-11 | Brak | Ghost prediction/intervention path removed; rebuild only through a future PRP. |

**Wniosek ogólny:** Dane są już **znacznie bogatsze** niż 2-3 miesiące temu. Największy skok dały: pełne friction_events (event_kind + intention/actual), p2_parsed i osobisty baseline w aggregates. 

To co jeszcze mocno blokuje: **jakościowe statusy friction** (raw vs confirmed) i brak masowego user feedbacku na wzorce (będzie chicken-egg).

---

## 2. Konkretne rodziny wzorców – co jest wykrywalne już teraz

Oto 11 wzorców posegregowanych od "najłatwiejszych do zrobienia w Faza 1.1" do trudniejszych.

### Tier S (najwyższa wartość + najłatwiejsze na start – rób pierwsze)

**Wzorzec S1: Powtarzające się blokery użytkownika (user_named_blockers → rzeczywiste friction)**

- Źródła: `p2_parsed.blocker_candidates` + `friction_events` (następne 3-7 dni) + `event_kind='friction_event'`
- Metoda: Proste grupowanie tekstowe (lub embedding) nazw blokera → zliczanie ile razy w ciągu N dni pojawił się pasujący friction (po friction_type lub similarity declared/actual).
- Minimalne N: 6-8 wieczorów z blockerami.
- Przykład outputu: "Kiedy nazywasz 'strach przed telefonem do klienta' jako blocker, w 8 na 11 przypadków w ciągu 4 dni pojawia się friction:communication_drift lub procrastination."
- Ryzyko: Niska jakość nazw blokera (parser), brak confirmed friction.
- Priorytet: **#1 w Etapie 1**

**Wzorzec S2: Morning protocol drift → następny dzień**

- Źródła: `daily_reconciliations` (first_90_protected, phone_first z operational_facts lub evening_extraction) + `vanguard_daily_aggregates` następnego dnia (execution_score, identity_score, final_state, dopamine_load)
- Metoda: Proste agregacje SQL + z-score względem personal baseline.
- Minimalne N: 8-10 dni z danymi obu stron.
- Przykład: "W dniach, w których first_90 był przerwany telefonem, średni execution_score następnego dnia był o 0.28 niższy niż Twój baseline (N=14)."
- Priorytet: **#2**

**Wzorzec S3: Sen + następnego dnia dominujący typ tarcia**

- Źródła: `oura_daily_summary.total_sleep_hours` (przez aggregates) + `friction_events` następnego dnia (agregacja po friction_type przy event_kind='friction_event')
- Metoda: Binowanie snu (<6.0 / 6.0-7.0 / >7.0) → rozkład friction_type.
- Przykład: "Po snach <6h u Ciebie 2.4× częściej pojawia się friction:procrastination i habit_break następnego dnia (N=19)."
- Priorytet: **#3** (bardzo wysoka wartość behavioralna)

**Wzorzec S4: Plan adherence (intencja wieczorna vs rzeczywistość)**

- Źródła: `planning_summary` (production_artifact, tension_action, minimum_viable_day) + `p2_parsed` + `friction_events` + `aggregates` następnego dnia.
- Metoda: Prosty scoring (czy artifact powstał? czy tension_action zrobiony? ile friction w obszarach planu? delta execution).
- Przykład: "W 7 na 9 ostatnich planów, w których zdefiniowałeś konkretny artifact + tension, reality adversary następnego wieczoru pokazywał inconsistency."
- Priorytet: **Bardzo wysoki** (core anty-self-deception)

### Tier A (wysoka wartość, trochę trudniejsze)

**Wzorzec A1: Sekwencje 3-5 dni prowadzące do złego stanu**

- Źródła: Ciąg `final_state` z aggregates + friction + p2 scores.
- Przykład: "U Ciebie sekwencja: 2× phone_first + 1× high fragmentation → z 78% prawdopodobieństwem w 4. dniu wchodzi CHAOS lub AVOIDANCE (N=12)."

**Wzorzec A2: "Narracja vs dane" – zmęczenie deklarowane vs biometria**

- Źródła: p2_parsed (lub stream) z frazami o zmęczeniu/stresie + aggregates (sen, hrv, readiness).
- Przykład: "W 11 przypadkach na 14, kiedy wieczorem mówiłeś 'jestem totalnie wykończony', Twoje dane Oura pokazywały sen ≥6.8h i readiness ≥65."

**Wzorzec A3: Persistent micro_behavior_observation → macro friction**

- Źródła: `friction_events` z event_kind='micro_behavior_observation' → później 'friction_event' tego samego typu.
- Przykład: "Obserwacja 'krzyżuję ręce i nie patrzę w oczy' powtarzała się 6 razy w ciągu 3 tygodni, po czym pojawiły się 4 friction:social_hesitation w sytuacjach zawodowych."

### Tier B (wartościowe, ale wymagają więcej danych lub lepszej jakości)

- Wzorzec: Rytm tygodniowy (np. "piątkowe avoidance" lub "poniedziałkowy peak execution").
- Wzorzec: Interakcja training + następny dzień (strava + aggregates + friction).
- Wzorzec: "Good day" signature (jakie 3-4 sygnały najczęściej współwystępują w dniach z day_score=5 i wysokim identity_score).
- Wzorzec: Dryf w blockerach (czy te same blokery wracają po 30-60 dniach?).

---

## 3. Co system już częściowo robi (i co można ewoluować)

- **VanguardCore states** (LOCKED_IN / AVOIDANCE / CHAOS / CONSUMING itd.) — to już jest prymitywny early warning / state machine. Można to wykorzystać jako jeden z sygnałów do wzorców.
- **Weekly synthesis** — już agreguje friction_by_type + biometrics + plannings. Idealny nośnik dla sekcji "wzorce tygodnia".
- **Plan quality signal** (`planQuality.ts`) — już istnieje i jest używany w morning-brief.
- **Reality Adversary** — już porównuje wczorajszy plan z 72h streamem. To jest proto-anty-self-deception.
- **Personal baseline + z-scores** — rewelacyjne do normalizacji (nie sztywne progi).

**Wniosek:** Dużo "pattern intelligence" już istnieje w systemie, ale jest **ukryte** (używane tylko wewnętrznie do stanów i ratunkowych briefów). Etap 1 = wyciągnięcie tego na powierzchnię dla użytkownika + dodanie warstwy "to się u Ciebie powtarza od X czasu".

---

## 4. Ograniczenia i ryzyka (być brutalnie szczerym)

1. **Jakość friction** — większość to 'raw'. Dopóki nie będzie mechanizmu masowego podnoszenia do 'confirmed' lub user feedbacku, wzorce oparte na friction będą miały szum.
2. **Oura timing (BACKLOG-03)** — wiele dni ma "pending" sen. Detektory S3 będą miały dziury.
3. **N małych** — na początku prawie wszystkie wzorce będą na N=7-15. Trzeba to zawsze eksponować ("N=11, siła obserwacji umiarkowana").
4. **Dualizm** — największe ryzyko pomieszania "użytkownik powiedział" z "fakty pokazały". Trzeba rygorystycznie rozróżniać w każdym komunikacie.
5. **Brak temporal links** — tabele istnieją, ale puste. Bez nich trudno będzie pokazywać "to pomogło / to zaszkodziło".
6. **Parser p2** — przy niskiej pewności (<0.5) blokery i costs są mało wiarygodne. Detektory muszą to filtrować.

---

## 5. Rekomendacja: pierwsze 4 wzorce do wdrożenia w Faza 1.1

1. **S1** – Powtarzające się blokery (najbliżej anty-self-deception + highest emotional salience dla użytkownika)
2. **S4** – Plan adherence / rozjazd deklaracja-rzeczywistość (core of the philosophy)
3. **S2** – Morning protocol → następny dzień (najłatwiejszy technicznie, bardzo akcyjny)
4. **S3** – Sen → następnego dnia typ tarcia (najczystsza korelacja behavioralna)

Te 4 dają największy stosunek "zmiana decyzji użytkownika" / "wysiłek implementacyjny".

Pozostałe (A1, A2...) wrzucamy w Faza 1.2 po zebraniu feedbacku na pierwszych czterech.

---

## 6. Co dalej z tym researchiem

- Użyj tego dokumentu jako input do projektowania detektorów (szczegóły implementacyjne w backlogu Epic 1).
- Przed pierwszym wdrożeniem detektora — zrób ręczny sanity check na 20-30 realnych rekordach z bazy (użytkownik może pomóc).
- Po 3-4 tygodniach używania pierwszych 4 wzorców — wróć do tego dokumentu i zaktualizuj "co się sprawdziło / co było szumem".

---

**Podsumowanie researchu:**  
Dane są już w stanie, w którym Etap 1 ma sens zaczynać. Największa wartość leży w **wyciągnięciu na wierzch** tego, co system już widzi wewnętrznie (stany, reality checks, baseline) + dodaniu 4-5 prostych, powtarzalnych detektorów opartych na najbogatszych źródłach (p2 + friction full schema + aggregates z personal baseline).

Nie czekamy na "idealną jakość". Czekamy na pierwsze 4 wzorce widoczne dla użytkownika + mechanizm mówienia "to nie jest prawda".

To jest dokładnie to, co odróżnia behavioral operating system od kolejnej appki do journalingu.