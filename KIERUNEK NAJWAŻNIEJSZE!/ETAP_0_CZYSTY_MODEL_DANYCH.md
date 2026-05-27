# ETAP 0 – Propozycja Czystego Modelu Danych Behawiuralnych (V0.9)

Data: czerwiec 2026

## 1. Cele modelu

- Jasny ownership warstw (surowe dane → zdarzenia → stany → refleksje → plany).
- Łatwość dodawania nowych typów danych w przyszłości.
- Dobra separacja faktów operacyjnych od refleksji użytkownika.
- Przygotowanie pod Etap 1 (silna widoczność wzorców) i Etap 2 (personalny model stanu).

## 2. Główne problemy obecnego modelu

- `daily_reconciliations` jest przeładowana (miesza wieczorną odpowiedź, p2_parsed, evening_extraction, planning_summary, metadane ranne/południowe).
- Dualizm `evening_extraction` ↔ `p2_parsed` jest niejasny.
- Brak wyraźnej warstwy "User State" w czasie.
- Brak wersjonowania i metadanych jakości przy ekstrakcjach.

## 3. Proponowana struktura warstw (docelowa)

### Warstwa 0 – Surowe dane
- `vanguard_stream` (pozostaje prawie bez zmian – źródło prawdy)

### Warstwa 1 – Zdarzenia behawioralne
- `friction_events` (z `event_kind`)
- W przyszłości ewentualnie inne tabele zdarzeń (np. `positive_actions`, `decisions` itp.)

### Warstwa 2 – Stany dzienne (agregaty)
- `vanguard_daily_aggregates` (już istnieje – warto tylko oczyścić i ustabilizować)

### Warstwa 3 – Refleksja wieczorna (najważniejsza nowa warstwa)
- `daily_reconciliations` – mocno odchudzona wersja:
  - `user_response` (surowa odpowiedź)
  - `p2_parsed` (główny nośnik refleksji)
  - Podstawowe metadane (data, status, answered_at itp.)
  - Linki do planowania (planning_status, planning_summary – ale tylko jako odniesienie)

- Nowa tabela (zalecana): `evening_operational_facts`
  - artifact
  - first_90_protected
  - tension_action_result
  - phone_first
  - analysis_substitution
  - tomorrow_first_artifact
  - extracted_from (id z daily_reconciliations)
  - parser_version
  - extraction_quality_score

### Warstwa 4 – Plany i decyzje
- `planning_summary` zostaje w `daily_reconciliations` (lub przeniesiona do osobnej tabeli `daily_plans` w przyszłości)

## 4. Rekomendowana ścieżka migracji (Etap 0)

**Krok 1 (teraz):**
- Zostawiamy `evening_extraction` jako legacy.
- Tworzymy nową tabelę `evening_operational_facts` (lub na razie trzymamy w `operational_facts` w `planningDraft` + kolumnie JSON).
- Wszystkie nowe zapisy operacyjnych faktów idą do nowej struktury.

**Krok 2 (w trakcie Etapu 0 / początek Etapu 1):**
- Oczyszczamy `daily_reconciliations` z niepotrzebnych kolumn historycznych.
- Wprowadzamy wyraźny podział w kodzie: `operational_facts` vs `user_reflection`.

**Krok 3 (koniec Etapu 0 / początek Etapu 1):**
- Decyzja czy migrujemy kluczowe pola operacyjne do P2 parsera, czy zostawiamy dedykowany lekki parser operacyjny.

## 5. Dodatkowe rekomendacje

- Wprowadzić tabelę `extraction_audits` do rejestrowania wyników pomiaru jakości.
- Dodać kolumnę `parser_version` wszędzie gdzie jest ekstrakcja LLM.
- Rozważyć tabelę `user_states` (dzienne lub nawet godzinne snapshoty stanu) – przygotowanie pod Etap 2.

---

Ten dokument jest wersją roboczą V0.9. Po decyzji co do dualizmu można go podnieść do V1.0.