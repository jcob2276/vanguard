# ETAP 0 – Proces Pomiaru Jakości Ekstrakcji (Gotowy do Wdrożenia)

## 1. Cele procesu

- Mieć powtarzalny, lekki mechanizm oceny jakości ekstrakcji (auto-classify + P2 parser).
- Widzieć trend jakości w czasie (czy się poprawia, czy pogarsza).
- Dostarczać dane do decyzji (np. czy prompt wymaga poprawy, czy dualizm jest bezpieczny do utrzymania).

## 2. Zakres pomiaru

Mierzymy dwie główne rzeczy:

**A. Auto-classify (vanguard-auto-classify)**
- Jakość wykrywania `friction_event` (czy poprawnie wykryto intencję + odchylenie)
- Błędy klasyfikacji `event_kind`
- Jakość kluczowych pól (`declared_intention`, `actual_behavior`, `deviation`, `immediate_cost`)

**B. P2 Parser (reconciliationParser)**
- Jakość refleksji użytkownika (`biggest_cost`, `best_move`, `blocker_candidates`, `correction`, `resource`)
- Częstość i zasadność `needs_manual_review`
- Spójność z `evening_extraction` (tam gdzie się pokrywają)

## 3. Proces (lekka wersja na start)

**Częstotliwość:** Co 2 tygodnie

**Próbka:**
- 40–60 losowych przykładów z ostatnich 14–21 dni
- Podział: ~30 z auto-classify, ~20–25 z P2 (lub proporcjonalnie do wolumenu)

**Metoda oceny:**
- Ręczna ocena przez 1–2 osoby (na początku najlepiej Ty + ktoś z zespołu)
- Prosty arkusz (Google Sheets lub Notion) z następującymi polami:

Dla auto-classify:
- ID rekordu
- event_kind (przewidziany)
- Czy event_kind jest poprawny? (Tak / Nie / Częściowo)
- Jakość `declared_intention` (1-5 lub N/A)
- Jakość `actual_behavior` (1-5 lub N/A)
- Jakość `deviation` (1-5 lub N/A)
- Główne problemy (kategorie błędów)
- Komentarz

Dla P2:
- Czy `biggest_cost` jest sensowny? (Tak / Nie / Częściowo)
- Czy `best_move` jest sensowny?
- Czy `blocker_candidates` są sensowne?
- Czy `needs_manual_review` jest zasadne?
- Ogólna ocena jakości refleksji (1-5)
- Komentarz

**Wyniki:**
- Agregacja co 2 tygodnie (proste średnie + najważniejsze problemy)
- Raz w miesiącu – krótkie podsumowanie trendu + rekomendacje co poprawiać w promptach

## 4. Wersjonowanie promptów + metadane jakości (równolegle)

**Wersjonowanie:**
- Każdy prompt ekstrakcyjny dostaje wersję (np. `auto-classify-v3`, `p2-parser-v2`)
- Wersja jest zapisywana przy każdej ekstrakcji (`parser_version` lub `extraction_version`)

**Metadane jakości (minimalne):**
- `parser_version`
- `extraction_confidence` (jeśli model zwraca)
- `extraction_quality_score` (0-100) – opcjonalnie, na początek można uzupełniać ręcznie podczas audytów
- `last_reviewed_at`
- `review_notes`

## 5. Rekomendowane zmiany techniczne (małe, ale ważne)

1. Dodać kolumny do `friction_events`:
   - `parser_version` (text)
   - `extraction_quality_score` (numeric, nullable)
   - `last_reviewed_at` (timestamptz, nullable)
   - `review_notes` (text, nullable)

2. Dodać przy zapisie `p2_parsed` w `daily_reconciliations`:
   - `p2_parser_version`

3. Stworzyć prostą tabelę pomocniczą `extraction_quality_audits` (na początek opcjonalnie – można zacząć od Google Sheets).

## 6. Pierwsze 3 audyty (praktyczny start)

**Audyt #1 (pierwszy):**
- Losujemy 50 przykładów
- Skupiamy się głównie na ocenie `friction_event` vs `state_observation` / `micro_behavior_observation`
- Cel: dostać pierwszy baseline jakości

**Audyt #2:**
- Dodajemy ocenę P2 parsera
- Porównujemy spójność z `evening_extraction` (tam gdzie się pokrywają)

**Audyt #3:**
- Patrzymy na trend + największe powtarzające się błędy
- Podejmujemy pierwsze decyzje co do promptów

---

Ten proces jest na tyle lekki, że da się go robić regularnie już od teraz, a jednocześnie daje realne dane do decyzji w Etapie 0 i na początku Etapu 1.