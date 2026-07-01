# ETAP 0 – Konkretna Lista Zadań (Backlog)

Cel: Doprowadzić fundament danych i ekstrakcji do stanu, w którym można bezpiecznie i z sensem ruszyć Etap 1 (Widoczność Wzorców + Anty-Self-Deception).

Zadania są podzielone na kategorie i mają proponowany priorytet.

---

## Kategoria A: Dualizm i Model Danych (najwyższy priorytet)

1. **Dokładne zmapowanie dualizmu** (już częściowo zrobione)
   - Pełna lista wszystkich pól używanych z `evening_extraction` + gdzie są czytane.
   - Pełna lista wszystkich pól używanych z `p2_parsed` + gdzie są konsumowane.
   - **Status:** Prawie gotowe (patrz ETAP_0_DUALIZM_MAPPING.md)

2. **Podjęcie decyzji strategicznej dualizmu**
   - Wybór między Opcją 1 (legacy + rozwój tylko po stronie P2) a Opcją 2 (szybsza migracja).
   - **Status:** Czeka na decyzję.

3. **Przygotowanie propozycji czystego modelu danych**
   - Propozycja struktury `daily_reconciliations` po odchudzeniu.
   - Decyzja czy tworzymy tabelę `evening_operational_facts`.
   - **Status:** Wersja robocza w ETAP_0_CZYSTY_MODEL_DANYCH.md.

4. **Pierwsze prace porządkujące dualizm**
   - Wprowadzenie wyraźnego podziału w `planningDraft` (`operational_facts` vs `user_reflection`) – już częściowo zrobione.
   - Oznaczenie w kodzie, które części są legacy.

---

## Kategoria B: Pomiar Jakości Ekstrakcji

5. **Zdefiniowanie procesu pomiaru jakości**
   - Co dokładnie mierzymy (metryki).
   - Jak często i w jaki sposób (sampling + ocena).
   - **Status:** Szczegółowa propozycja w ETAP_0_PROCES_POMIARU_JAKOSCI.md.

6. **Przygotowanie narzędzi do audytu**
   - Prosty arkusz / formularz do oceny (Google Sheets lub Notion na start).
   - Lista kategorii błędów (dla auto-classify i dla P2).

7. **Pierwszy audyt jakości (baseline)**
   - Losowanie i ocena 40-60 przykładów.
   - Zapisanie wyników jako punkt odniesienia.

8. **Wprowadzenie metadanych jakości**
   - Dodanie kolumn: `parser_version`, `extraction_quality_score`, `last_reviewed_at` itp.
   - Logowanie wersji parsera przy każdym zapisie ekstrakcji.

---

## Kategoria C: Wersjonowanie i Standaryzacja

9. **Wprowadzenie wersjonowania promptów**
   - Konwencja nazewnictwa wersji.
   - Zapis wersji przy każdej ekstrakcji.
   - **Status:** Propozycja w ETAP_0_WERSJONOWANIE_I_METADANE.md.

10. **Uporządkowanie kodu ekstraktorów**
    - Wyciągnięcie promptów do stałych / plików konfiguracyjnych.
    - Łatwa możliwość przełączania wersji.

---

## Kategoria D: Dokumentacja

11. **Dokument "Model Danych Behawiuralnych V0.9"**
    - Opis warstw danych.
    - Ownership tabel i pól.
    - Relacje między tabelami.
    - **Status:** Wersja robocza w ETAP_0_CZYSTY_MODEL_DANYCH.md.

12. **Kryteria zakończenia Etapu 0**
    - Co musi być zrobione, żeby uznać Etap 0 za zamknięty i przejść do Etapu 1.
    - (Ten dokument powinien powstać na końcu Etapu 0)

---

## Priorytetyzacja (propozycja)

**Must have (zrób to najpierw):**
- Zadania 1, 2, 3, 5, 8

**Should have:**
- Zadania 4, 6, 7, 9, 10

**Nice to have (można odłożyć):**
- Zadania 11, 12 (dokumentacja i kryteria można robić równolegle)

---

## Szacowany wysiłek

Przy dedykowanym zespole 2-4 osób Etap 0 powinien dać się domknąć w 6-10 tygodni (w zależności jak szybko zapadną decyzje w kluczowych punktach, szczególnie dualizm).

---

**Uwaga:** Ten backlog jest żywy. Po podjęciu decyzji co do dualizmu i po pierwszym audycie jakości powinien być zaktualizowany.