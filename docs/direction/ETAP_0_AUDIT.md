# ETAP 0 – Audyt Fundamentu (Stan na teraz)

**Cel Etapu 0:** Zbudować absolutnie solidną, czystą i długoterminowo skalowalną warstwę danych behawioralnych.

Ten dokument jest żywy – będę go aktualizował w miarę pogłębiania audytu.

---

## 1. Aktualny stan kluczowych komponentów

### 1.1 vanguard-auto-classify (główny ekstraktor zdarzeń)

**Mocne strony:**
- Ma już całkiem dobrą, przemyślaną taksonomię (`event_kind`).
- Prompt jest stosunkowo dobrze zabezpieczony przed fałszywymi `friction_event` (ostatnie zaostrzenie z czerwca).
- Rozróżnia `friction_event`, `positive_micro_action`, `state_observation`, `micro_behavior_observation`, `reflection`.

**Słabe strony / ryzyka:**
- Brak systematycznego pomiaru jakości (precision/recall) na realnych danych.
- Nie ma wersji promptów + trackingu, jak zmienia się jakość w czasie.
- `vanguard-friction-qa` został wyłączony jako raport Telegram; QA klasyfikatora wymaga nowego procesu SQL/dashboard.

### 1.2 reconciliationParser (P2 parser)

**Mocne strony:**
- Dobrze zdefiniowany kontrakt.
- Ma sensowne pola (biggest_cost, best_move, blocker_candidates, correction itp.).
- Zapisuje `parse_confidence` i `needs_manual_review`.

**Słabe strony / ryzyka:**
- Nie wiemy, jaka jest rzeczywista jakość na Twoich głosówkach (brak regularnego audytu).
- Nie jest jeszcze w pełni zintegrowany z resztą systemu (wciąż istnieje dualizm z `evening_extraction`).

### 1.3 daily_reconciliations + dualizm

Obecnie na jednym rekordzie mieszają się:
- `user_response` + `p2_parsed` (refleksja użytkownika)
- `evening_extraction` (bardziej operacyjne rzeczy)
- `planning_summary` (plan na jutro)

**Problem:** Te dwie rzeczy (operacyjne fakty vs refleksja użytkownika) mają inną naturę i powinny być traktowane inaczej.

### 1.4 vanguard_daily_aggregates + sygnały

Masz już `vanguardCore.ts` – to jest dobry fundament do obliczania stanu.

Jednak:
- Brakuje wyraźnego, wersjonowanego **User State Model** w czasie.
- Agregaty są dość podstawowe.

---

## 2. Największe problemy do rozwiązania w Etapie 0

1. **Brak pomiaru jakości ekstrakcji**
   - Nie wiemy, jak dobry jest auto-classify i P2 parser w praktyce.
   - Bez tego nie da się sensownie ulepszać.

**Szczegółowa propozycja pomiaru jakości (pierwszy temat):**

**Cel:** Mieć powtarzalny, lekki proces dający trend jakości w czasie.

**Co mierzymy:**
- Jakość wykrywania `friction_event` (intencja + deviation)
- Błędy klasyfikacji `event_kind` (state_observation wrzucone jako friction)
- Jakość P2 (biggest_cost, best_move, blocker_candidates – czy oddają to co użytkownik powiedział)
- Spójność między `evening_extraction` a P2 (tam gdzie się pokrywają)

**Jak mierzyć (prosty proces na start):**
- Co 2 tygodnie losujemy 40-60 przykładów z ostatnich 14-21 dni.
- Ręczna ocena według prostego schematu (1-5 + kategoria błędu).
- Wyniki w Google Sheet / Notion (na początek nie musi być w bazie).
- Raz w miesiącu krótkie podsumowanie trendu + decyzje co poprawiać w promptach.

**Szybkie usprawnienia techniczne:**
- Dodać do `friction_events`: `parser_version`, `extraction_quality_score`, `last_reviewed_at`.
- W `daily_reconciliations` przy zapisie `p2_parsed` – zapisywać wersję parsera.

To jest na tyle lekkie, że da się robić regularnie i daje twarde dane do decyzji.

2. **Dualizm evening_extraction vs p2_parsed**
   - To jest bałagan, który będzie tylko rósł.
   - Trzeba podjąć wyraźną decyzję ownershipu pól.

3. **Brak długoterminowej, czystej struktury danych**
   - Tabele rosną, ale nie ma jasnej filozofii, co jest "źródłem prawdy" na poziomie lat.

4. **Słabe tooling wokół jakości danych**
   - Stary `vanguard-friction-qa` był raportem Telegram, nie regularnym procesem poprawy; został wyłączony.

---

## 3. Rekomendacje i proponowany zakres Etapu 0

### 3.1 Najważniejsze decyzje do podjęcia szybko

**A. Dualizm evening_extraction vs p2_parsed (krytyczne)**

**Aktualny obraz (po analizie):**
- `evening_extraction` jest używane **prawie wyłącznie** w `reconciliation.ts` (budowa bridge message + `operational_facts` w planningDraft). Prawie nigdzie indziej nie jest czytane.
- `p2_parsed` jest już konsumowane w reconciliation, planning, morning-brief i Oracle (z progami pewności).
- Mamy więc klasyczny dualizm: dwa równoległe LLM-y robiące częściowo podobne rzeczy.

**Opcje:**

**Opcja 1 (zalecana przeze mnie na teraz):**
- Zostawiamy `evening_extraction` jako **legacy** na najbliższe 6-9 miesięcy.
- Wszystkie nowe rzeczy i ulepszenia idą wyłącznie do warstwy P2 / `user_reflection`.
- W `planningDraft` utrzymujemy wyraźny podział (`operational_facts` vs `user_reflection`).
- W perspektywie 6-12 miesięcy planujemy większą migrację (albo wzmocnienie P2 o pola operacyjne, albo stworzenie jednego mocnego wieczornego parsera).

**Opcja 2 (bardziej agresywna):**
- Szybciej zaczynamy migrować kluczowe pola operacyjne (artifact, first_90, tension_result) do P2 parsera lub nowego dedykowanego parsera.
- Wymaga więcej pracy w krótkim terminie, ale zmniejsza dług techniczny.

**Moja rekomendacja:** Idziemy w Opcję 1. Jest bezpieczniejsza, pozwala nam najpierw dobrze ogarnąć pomiar jakości i Faza 1 (widoczność wzorców), a dualizm rozwiązujemy w bardziej przemyślany sposób później.

**B. Pomiar jakości ekstrakcji**
- Bez tego Etap 0 nie ma sensu.
- Trzeba wprowadzić prosty, ale regularny pomiar jakości (sampling + ocena).

### 3.2 Proponowany zakres prac Etapu 0

#### A. Audyt i pomiary jakości (najwyższy priorytet)
- Zbudować prosty proces regularnego audytu jakości auto-classify i P2 parsera (np. co 2 tygodnie ręczny przegląd +30-50 przykładów).
- Wprowadzić wersjonowanie promptów + logowanie wersji, która została użyta przy ekstrakcji.
- Stworzyć nowy mechanizm SQL/dashboard do systematycznego mierzenia jakości; nie wznawiać raportów Telegram.

#### B. Uporządkowanie dualizmu (równolegle)
- Zmapować wszystkie pola używane z `evening_extraction`.
- Zdecydować, które pola zostają, które migrujemy do P2/refleksji.
- Wprowadzić czysty podział w `planningDraft` (co już częściowo zrobiłem przez `operational_facts` / `user_reflection`).

#### C. Standaryzacja i jakość danych
- Wersjonowanie wszystkich promptów ekstrakcyjnych.
- Dodanie metadanych jakości do rekordów (np. `extraction_quality_score`, `parser_version`).
- Uporządkowanie kolumn w `daily_reconciliations` (wiele pól narosło historycznie).

#### D. Dokumentacja
- Napisać dokument **"Model Danych Behawiuralnych V1"** – co jest źródłem prawdy, jakie są warstwy, jakie są relacje między tabelami.

---

## 4. Konkretny plan prac – Etap 0 (propozycja)

### Sprint 0.1 (pierwsze 2-3 tygodnie)
- [ ] Dokładne zmapowanie wszystkich pól z `evening_extraction` + gdzie są używane.
- [ ] Zmapowanie wszystkich pól z `p2_parsed` + gdzie są aktualnie konsumowane.
- [ ] Propozycja decyzji: co zostawiamy w evening_extraction na najbliższe 6 miesięcy, a co kierujemy do P2/refleksji.
- [ ] Wprowadzenie prostego wersjonowania promptów (auto-classify + P2).

### Sprint 0.2 (kolejne 3-4 tygodnie)
- [ ] Zbudowanie pierwszego prostego mechanizmu pomiaru jakości ekstrakcji (sampling + ręczna ocena).
- [ ] Wprowadzenie metadanych jakości do rekordów (parser_version, extraction_confidence itp.).
- [ ] Pierwsza wersja dokumentu "Model Danych Behawiuralnych V0.5".

### Sprint 0.3
- [ ] Decyzja i pierwsze prace porządkujące dualizm (jeśli decyzja będzie już podjęta).
- [ ] Uporządkowanie kolumn w `daily_reconciliations` (usunięcie martwych / niejasnych pól).
- [ ] Regularny proces audytu jakości (np. co 2 tygodnie).

---

## 5. Podsumowanie – co proponuję na teraz

**Pierwszy temat (pomiar jakości):**
- Wprowadzamy lekki, powtarzalny proces ręcznego audytu co 2 tygodnie (sampling 40-60 przykładów).
- Dodajemy podstawowe metadane jakości do tabel.
- Na początek nie budujemy ciężkiego systemu – ma być realny do robienia regularnie.

**Drugi temat (dualizm):**
- Rekomenduję Opcję 1: zostawiamy `evening_extraction` jako legacy na 6-9 miesięcy.
- Cały nowy rozwój idzie w stronę `p2_parsed` / `user_reflection`.
- Wyraźny podział w `planningDraft` już częściowo mamy.

---

## 6. Pytania / Decyzje na teraz

1. Czy idziemy z moją rekomendacją dualizmu (legacy + rozwój tylko po stronie P2)?
2. Czy akceptujesz proponowany lekki proces pomiaru jakości (co 2 tygodnie sampling + ręczna ocena)?
3. W jakim stylu chcesz prowadzić dalszy Etap 0?
   - Wolisz, żebym przygotowywał gotowe rekomendacje i propozycje do akceptacji?
   - Czy wolisz być bardziej w pętli i dostawać aktualny stan + pytania częściej?

Daj znać, a ja od razu wchodzę w kolejne konkrety (np. dokładne zmapowanie pól albo propozycję struktury danych).

---

**Status:** W trakcie audytu.

---

## Decision Record – Dualizm (zaakceptowany)

**Data:** Czerwiec 2026  
**Decyzja:** Zaakceptowano strategię **"Legacy + New Path"** na 6–9 miesięcy.

**Szczegóły decyzji** znajdują się w dedykowanym dokumencie:  
`ETAP_0_DECYZJA_DUALIZMU_SHORT.md`

**Kluczowe punkty zaakceptowane:**
- `evening_extraction` = legacy operational compatibility layer
- `p2_parsed` = primary reflection and planning signal
- Wszystkie nowe rzeczy idą przez `p2_parsed` / `user_reflection`
- W `planningDraft` utrzymujemy wyraźny podział (`operational_facts` vs `user_reflection`)

**Sunset Criteria:** `evening_extraction` można usunąć dopiero gdy P2 ma stabilną jakość, wszystkie krytyczne operational facts mają odpowiednik, i system działa bez legacy fallbacków przez min. 30 dni.

**Migration Trigger:** Migrację rozważamy dopiero po zakończeniu Etapu 1 + ustabilizowaniu signal quality + wdrożeniu quality audits dla P2.

**Kluczowa zasada:** Nie poświęcamy działającego usage loopa dla „idealnej architektury”.

---

Jak chcesz, żebym prowadził ten etap dalej?  
- Czy wolisz, żebym przygotowywał gotowe rekomendacje i propozycje zmian?
- Czy chcesz, żebym co kilka dni wrzucał aktualny stan + pytania decyzyjne?
