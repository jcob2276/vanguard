# ETAP 0 – Plan Wdrożeniowy na 4 Tygodnie (po decyzji dualizmu)

**Strategia:** Legacy + New Path (zaakceptowana)  
**Cel:** Domknąć kluczowe elementy Etapu 0 tak, żeby można było bezpiecznie ruszyć Etap 1.

---

## Założenia planu

- Nie ruszamy działającego reconciliation + planning loopa.
- Cały nowy rozwój idzie przez `p2_parsed` / `user_reflection`.
- `evening_extraction` traktujemy jako legacy (oznaczamy, ale nie usuwamy).
- Priorytet: jakość danych + signal quality + możliwość bezpiecznego wejścia w Etap 1.

---

## Tydzień 1 – Decyzja + Fundament wersjonowania

**Główne cele:**
- Oficjalnie zamknąć decyzję dualizmu
- Wprowadzić wersjonowanie promptów + podstawowe metadane

**Zadania:**

- [ ] Oficjalnie zaakceptować i zapisać decyzję dualizmu (DECYZJA_001_DUALIZMU.md)
- [ ] Oznaczyć w kodzie części związane z `evening_extraction` jako `// LEGACY`
- [ ] Wprowadzić wersjonowanie promptów:
  - `auto-classify-vX`
  - `p2-parser-vX`
- [ ] Dodać kolumny:
  - `friction_events.parser_version`
  - `daily_reconciliations.p2_parser_version`
- [ ] Zacząć logować wersję parsera przy każdej ekstrakcji

**Deliverable na koniec tygodnia:**
- Wersjonowanie działa i jest zapisywane w bazie.

---

## Tydzień 2 – Proces jakości + pierwszy audyt

**Główne cele:**
- Uruchomić proces pomiaru jakości
- Zrobić pierwszy baseline

**Zadania:**

- [ ] Przygotować prosty arkusz do audytu jakości (Google Sheets / Notion)
- [ ] Zdefiniować kategorie błędów dla auto-classify i P2
- [ ] Wykonać pierwszy audyt (40-60 przykładów z ostatnich 14-21 dni)
- [ ] Zapisać wyniki jako baseline w ETAP_0_AUDIT.md
- [ ] Dodać podstawowe metadane jakości (`last_reviewed_at`, `extraction_quality_score` na początek)

**Deliverable na koniec tygodnia:**
- Pierwszy audyt jakości wykonany + wyniki udokumentowane.

---

## Tydzień 3 – Model danych + komunikacja

**Główne cele:**
- Uporządkować dokumentację modelu danych
- Zaznaczyć w dokumentacji strategię legacy

**Zadania:**

- [ ] Zaktualizować / stworzyć dokument "Model Danych Behawiuralnych V0.9"
- [ ] W dokumentacji (szczególnie w modelu danych i AGENTS.md) zapisać:
  - Ownership (legacy vs primary)
  - Sunset Criteria
  - Migration Trigger
- [ ] Zaktualizować ETAP_0_AUDIT.md i ETAP_0_ZADANIA.md po wynikach pierwszego audytu

**Deliverable na koniec tygodnia:**
- Model danych udokumentowany z jasnym ownershipem.

---

## Tydzień 4 – Stabilizacja i zamknięcie Etapu 0

**Główne cele:**
- Uruchomić regularny proces audytu jakości
- Domknąć Etap 0

**Zadania:**

- [ ] Uruchomić regularny proces audytu jakości (co 2 tygodnie)
- [ ] Sprawdzić wszystkie punkty z ETAP_0_CHECKLIST_ZAKONCZENIA.md
- [ ] Zaktualizować ETAP_0_STATUS.md i ETAP_0_GOTOWOSC_DO_ETAPU_1.md
- [ ] Przygotować krótkie podsumowanie "Etap 0 – co zostało zrobione"
- [ ] Zdecydować o dacie oficjalnego zamknięcia Etapu 0

**Deliverable na koniec tygodnia:**
- Etap 0 uznany za zamknięty (lub z jasnym planem domknięcia w 1-2 tygodnie).

---

## Kluczowe decyzje w tych 4 tygodniach

1. **Tydzień 1** – Oficjalna akceptacja strategii dualizmu
2. **Tydzień 2** – Uruchomienie pierwszego audytu jakości
3. **Tydzień 4** – Decyzja o zamknięciu Etapu 0

---

## Uwagi

- Ten plan jest elastyczny. Jeśli decyzja dualizmu zajmie więcej czasu – przesuwamy resztę.
- Najważniejsze jest utrzymanie stabilności codziennego użycia.
- Po zamknięciu Etapu 0 wchodzimy w Etap 1 (Widoczność Wzorców + Anty-Self-Deception) z czystym fundamentem.

---

**Status:** Plan gotowy do realizacji po zaakceptowaniu strategii dualizmu.