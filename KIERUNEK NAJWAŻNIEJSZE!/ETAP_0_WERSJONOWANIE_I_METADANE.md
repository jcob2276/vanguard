# ETAP 0 – Wersjonowanie Promptów + Metadane Jakości (Plan Techniczny)

## 1. Dlaczego to jest ważne

Bez wersjonowania promptów i metadanych jakości:
- Nie wiemy, która wersja ekstraktora wyprodukowała dany rekord.
- Trudno analizować trendy jakości w czasie.
- Trudno robić eksperymenty z promptami (A/B).
- Przy migracji dualizmu nie będziemy mieli danych, która wersja była lepsza.

## 2. Proponowany system wersjonowania

**Konwencja nazewnictwa:**
- `auto-classify-v4`
- `p2-parser-v2`
- `operational-facts-v1` (jeśli stworzymy dedykowany parser operacyjny)

**Gdzie zapisywać wersję:**

1. `friction_events.parser_version` (text)
2. `daily_reconciliations.p2_parser_version` (text) – lub wewnątrz `p2_parsed` jako pole `parser_version`
3. Opcjonalnie: `daily_reconciliations.evening_extraction_version` (jeśli zostawimy legacy)

## 3. Metadane jakości (minimalny zestaw)

Dla `friction_events`:
- `parser_version`
- `extraction_confidence` (jeśli model zwraca – np. z structured output)
- `extraction_quality_score` (0-100) – na początek uzupełniane podczas audytów
- `last_reviewed_at`
- `review_notes`

Dla `daily_reconciliations` (dla P2):
- `p2_parser_version`
- `p2_confidence` (można wyciągać z `p2_parsed`)
- `p2_needs_manual_review` (można wyciągać z `p2_parsed`)

## 4. Proces wprowadzania nowych wersji promptów

1. Nowa wersja promptu dostaje nową nazwę (np. `auto-classify-v5`).
2. Wdrażamy ją najpierw tylko dla części ruchu (np. 20-30% losowych rekordów) – jeśli technicznie możliwe.
3. Po 2-3 audytach porównujemy jakość starej i nowej wersji.
4. Jeśli nowa jest wyraźnie lepsza – robimy pełne wdrożenie + aktualizujemy default.
5. Stare wersje zostają w bazie (dla historycznej analizy).

## 5. Rekomendowane zmiany techniczne (małe)

1. Dodać kolumny `parser_version` w `friction_events` i `daily_reconciliations` (jeśli jeszcze nie ma).
2. Przy każdym zapisie ekstrakcji – zawsze zapisywać aktualną wersję.
3. W kodzie ekstraktorów – wersje promptów trzymać w stałych / configu (nie hardkodowane w środku funkcji).
4. Stworzyć małą tabelkę lub plik z historią wersji promptów + datą wdrożenia + linkiem do PR.

---

Ten system wersjonowania + metadanych jest prosty, ale daje ogromną wartość przy dalszym rozwoju (szczególnie przy decyzjach o dualizmie i przy Etapie 1).