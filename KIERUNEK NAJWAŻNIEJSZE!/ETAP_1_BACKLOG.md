# ETAP 1 – Backlog (Widoczność Wzorców + Anty-Self-Deception)

**Cel Etapu 1:**  
Zbudować system, który daje użytkownikowi **wyraźną, codzienną i długoterminową widoczność** swoich własnych wzorców behawioralnych oraz aktywnie pomaga w redukowaniu samooszukiwania.

To jest faza o **najwyższym stosunku wartości do wysiłku** w całym roadmapie V10.

**Filozofia (nie do negocjacji):**
- Evidence layer first. Wzorce = powtarzalne, mierzalne relacje między sygnałami, nie interpretacje.
- Dualizm szanowany: `operational_facts` (co się faktycznie wydarzyło) vs `user_reflection` (co użytkownik sam o tym myśli wieczorem).
- Żadnego "wiesz lepiej niż Ty". Tylko: "Patrz, to się powtarza u Ciebie od X dni z siłą Y".
- "Confirmed pattern" wymaga explicit N i minimalnego progu pewności. Inaczej — hipoteza / obserwacja.
- Najpierw tekstowe iniekcje do istniejących flow (bridge, brief, Oracle, weekly). Zero nowych ciężkich UI na start.

---

## Zasady backlogu Etapu 1

1. Najpierw **wykrywalność** na istniejących danych (friction_events z pełnym event_kind + p2_parsed + aggregates + planning_summary).
2. Potem **widoczność** (najpierw w miejscach, gdzie użytkownik już jest).
3. Mechanizmy korekty / oznaczania przez użytkownika (antidotum na fałszywe wzorce).
4. Wszystko wersjonowane + z metadanymi jakości (jak w Etapie 0).
5. Równoległość z Etapem 0: research + projektowanie + proste detektory SQL — tak. Ciężkie produkcyjne detektory LLM-dependent — dopiero po pierwszym audycie jakości.

---

## Model danych dla wzorców (pierwsza wersja)

**Nowa tabela (propozycja do wdrożenia w Fazie 1.1):**

```sql
vanguard_behavioral_patterns (
  id uuid PK
  user_id uuid
  pattern_type text          -- 'recurring_blocker', 'protocol_drift', 'state_transition', 'friction_cluster', 'intention_vs_outcome', 'morning_protocol_impact' ...
  signature text             -- krótki unikalny identyfikator (np. "sleep<6.2 + phone_first → friction:procrastination")
  description text           -- czytelna dla człowieka wersja
  evidence jsonb             -- { n_days: 14, strength: 0.71, conditions: {...}, outcomes: {...}, examples: [stream_ids] }
  first_seen date
  last_seen date
  occurrence_count int
  avg_impact numeric         -- np. delta execution_score lub identity_score
  confidence numeric         -- 0-1 (na razie proste heurystyki + N)
  status text                -- 'hypothesis' | 'visible' | 'user_confirmed' | 'user_rejected' | 'archived'
  user_notes text
  created_at, updated_at
)
```

Na start: można zacząć od jsonb w istniejącej tabeli lub nawet w `vanguard_curiosity_queue` (ewolucja), ale docelowo dedykowana tabela z indeksami.

**Zasada:** Wzorce są **tylko do odczytu** dla użytkownika na początku. Edycja = tylko status + user_notes.

---

## Epiki Etapu 1 (z priorytetami i konkretnymi zadaniami)

### Epic 1: Personal Pattern Memory – Faza 1.1 (najwyższy ROI)

**Cel:** Najprostsze, najbardziej powtarzalne wzorce stają się widoczne w codziennych flow bez proszenia o nie.

#### Zadania High (pierwsze 3-4 tygodnie)

- [ ] **1.1.1** Zdefiniować i zaimplementować kontrakt `DetectedPattern` (TypeScript + SQL). Wersja 0.1 w kodzie shared.
- [ ] **1.1.2** Prosty detektor #1: "Powtarzające się user_named_blockers" (z p2_parsed.blocker_candidates + friction_events). Grupowanie po podobieństwie (proste + embedding na później).
- [ ] **1.1.3** Prosty detektor #2: "Morning protocol → execution next day" (first_90_protected + phone_first z operational_facts vs execution_score / identity_score z aggregates następnego dnia). Minimum N=7-10 dni.
- [ ] **1.1.4** Prosty detektor #3: "Sen + następnego dnia dominujący friction_type" (oura + friction_events następnego dnia, agregacja po event_kind='friction_event').
- [ ] **1.1.5** Zapis wykrytych wzorców do tabeli (lub tymczasowo do curiosity_queue z nową kategorią `pattern`).
- [ ] **1.1.6** Iniekcja 1-2 najsilniejszych wzorców do:
  - wieczornego bridge (po reconciliation)
  - porannego briefu (sekcja "Co się u Ciebie powtarza")
  - kontekstu Oracla (gdy pytanie dotyczy "ostatnio" / "trend" / "dlaczego")

#### Zadania Medium (tygodnie 4-7)

- [ ] Rozszerzenie detektorów o sekwencje 3-5 dni (np. "2 dni z phone_first → 3 kolejne dni z wysokim dopamine_load i spadkiem execution").
- [ ] Mechanizm "user feedback on pattern" (przyciski w Telegramie: "To ma sens", "To nie moje", "Obserwuj dalej").
- [ ] Porównanie "moje 5 najlepszych dni vs 5 najgorszych" pod kątem 3-4 kluczowych sygnałów (z aggregates + friction + p2).
- [ ] Dashboard minimalny (nawet jako długa wiadomość na żądanie `/patterns` lub przycisk).

### Epic 2: Anty-Self-Deception Engine (równolegle z 1.1)

**Cel:** Regularne, bezlitosne pokazywanie rozjazdów deklaracja vs rzeczywistość (szczególnie planning vs wykonanie).

#### High Priority (pierwsze 4 tygodnie)

- [ ] **2.1.1** Detektor rozjazdu plan vs rzeczywistość (planning_summary.production_artifact + tension_action vs p2_parsed + friction_events + aggregates następnego dnia). Prosty scoring "plan adherence".
- [ ] **2.1.2** Raport 7-dniowy "Deklaracje vs dane" wysyłany automatycznie (np. w ramach weekly-synthesis lub osobny cron) — konkretne przykłady z cytatami z p2 i z friction.
- [ ] **2.1.3** Szczególny nacisk na "blocker_candidates" użytkownika vs rzeczywiste friction_events w kolejnych dniach (czy te blokery się materializowały?).
- [ ] **2.1.4** Oznaczanie przez użytkownika "to był świadomy wybór / wyjątek" vs "to było samooszukiwanie" na poziomie pojedynczego rozjazdu.

#### Medium

- [ ] Wykrywanie "narracji vs dane" — np. użytkownik często mówi "jestem zmęczony" (p2 lub stream), a aggregates pokazują normalny sen + wysoką gotowość.
- [ ] Historyczny "drift score" per tydzień (ile % planów miało istotny rozjazd).

### Epic 3: Early Warning System (Faza 1.2)

**Cel:** Zanim wejdziesz głęboko w zły cykl — dostajesz dowód historyczny.

#### High (po Fazie 1.1)

- [ ] Zdefiniować 4-6 "złych reżimów" na podstawie rzeczywistych danych historycznych użytkownika (CHAOS, AVOIDANCE, CONSUMING + specyficzne dla niego kombinacje, np. "wysoki fragmentation + recurring procrastination").
- [ ] Prosty detektor wejścia w reżim (ostatnie 3-5 dni vs baseline).
- [ ] Komunikat: "Wchodzisz w schemat, który u Ciebie w ostatnich 4 przypadkach kończył się X dni niskiego wykonania i Y wzrostem dryfu. Ostatni raz tak było [data]."
- [ ] Możliwość wyciszenia konkretnego typu ostrzeżenia.

### Epic 4: Narzędzia eksploracji historii (Faza 1.3+)

- Lepsze filtrowanie streamu + friction (po event_kind, friction_type, tagach).
- "Pokaż mi wszystkie dni, w których nazwałem ten sam blocker".
- Porównanie okresów (najlepsze 14 dni vs najgorsze 14 dni — co się różniło w sygnałach?).
- Eksport do markdown/refleksji.

---

## Fazy wdrożeniowe (realistyczne)

**Faza 1.1 (Tygodnie 1-4) — "Najpierw widać to, co najbardziej boli"**
- 3-4 najprostsze detektory oparte głównie na SQL + agregacjach (blockers, morning protocol, sen→friction, plan adherence).
- Iniekcje do bridge + brief + Oracle context.
- Podstawowy zapis wzorców + user feedback (2-3 przyciski).
- Brak nowych tabel jeśli da się na początek (użyć curiosity_queue jako tymczasowy nośnik).

**Faza 1.2 (Tygodnie 5-8)**
- Early Warning na 2-3 reżimach.
- Lepsze anty-self-deception (cotygodniowe raporty rozjazdów z cytatami).
- Pierwsze bardziej złożone detektory (sekwencje + interakcje sygnałów).
- Mechanizm "to nie jest mój wzorzec" z wyjaśnieniem dlaczego system go widział.

**Faza 1.3 (Tygodnie 9+)**
- Zaawansowana pamięć wzorców (temporal links, clustering).
- Dedykowane narzędzie eksploracji.
- Predykcyjne użycie wzorców w planowaniu (jako kontekst, nie jako rada).

---

## Integracja z istniejącym daily loop (kluczowe punkty)

| Miejsce                  | Co można tam pokazać (Faza 1.1)                          | Priorytet |
|--------------------------|-----------------------------------------------------------|---------|
| Bridge po reconciliation | "Zauważyłem, że kiedy nazywasz X jako blocker, to w 70% przypadków w ciągu 4 dni pojawia się friction:procrastination" | High |
| Morning brief            | Krótka sekcja "Powtarzający się schemat z ostatnich 14 dni" (1-2 najsilniejsze) | High |
| Oracle (przy pytaniach o trendy) | Dodatkowy blok kontekstu "Twoje powtarzalne wzorce" | High |
| Weekly synthesis         | Sekcja "Najsilniejsze wzorce tego tygodnia + rozjazdy deklaracja/rzeczywistość" | High |
| Planning (jako kontekst) | "Ostatnie 3 razy kiedy miałeś podobny stan energetyczny + te blokery, plan adherence był niski" | Medium |
| Friction QA              | Ewolucja w stronę "czy ten friction potwierdza istniejący wzorzec?" | Medium |

---

## Metryki sukcesu Etapu 1 (jak poznamy, że działa)

- Użytkownik reaguje na surfaced patterns (kliknięcia / odpowiedzi / korekty) średnio X razy w tygodniu.
- Wzrost liczby oznaczonych "user_confirmed" wzorców (nie tylko hipotez).
- Widoczna zmiana w zachowaniu użytkownika (np. mniej powtarzających się friction tego samego typu po 6-8 tygodniach).
- W ankiecie / refleksji: "Zacząłem zauważać rzeczy, których wcześniej nie widziałem".
- Zero skarg na "system mi mówi co mam robić".

---

## Ryzyka i guardrails

- **Fałszywe wzorce** (niska jakość ekstrakcji) → zawsze pokazywać z confidence + N + przyciskiem "To nie jest prawda".
- **Overfitting do małej historii** → minimalne N w zależności od typu wzorca (np. 8-10 dla prostych korelacji).
- **Dualizm** → nigdy nie mieszamy "użytkownik powiedział wieczorem X" z "fakty pokazały Y" w jednym zdaniu bez wyraźnego rozróżnienia.
- **Performance** → detektory na cron (noc) lub lazy (przy otwarciu briefu), nigdy w hot path Telegram.

---

**Status:** Backlog pogłębiony (czerwiec 2026). Będzie ewoluował na podstawie researchu istniejących danych (patrz ETAP_1_RESEARCH_...) i pierwszych wdrożeń.

**Zależność:** Część detektorów wymaga minimum jakości sygnałów z Etapu 0 (szczególnie statusy friction_events i extraction_quality). Dlatego pierwsze detektory idą na "raw" + z widocznym confidence.