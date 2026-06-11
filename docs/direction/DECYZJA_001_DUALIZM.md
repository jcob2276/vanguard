# DECYZJA 001 – Strategia Dualizmu (evening_extraction vs p2_parsed)

**Data decyzji:** Czerwiec 2026  
**Status:** ZAAKCEPTOWANA

## Kontekst

W systemie istnieją obecnie dwa parsery wieczorne:

- `evening_extraction` – starszy parser (wbudowany w reconciliation handler). Głównie wyciąga fakty operacyjne (artifact, first_90_protected, tension_action_result, phone_first, analysis_substitution, tomorrow_first_artifact).
- `p2_parsed` – nowszy, dedykowany parser (`reconciliationParser.ts`). Wyciąga przede wszystkim refleksję użytkownika (biggest_cost, best_move, blocker_candidates, day_score, correction, resource + metadane pewności: `parse_confidence`, `needs_manual_review`).

**Aktualne użycie (stan na moment decyzji):**
- `evening_extraction` jest czytane prawie wyłącznie w reconciliation.ts (budowa bridge message + `operational_facts`).
- `p2_parsed` jest już konsumowane w: reconciliation, planning, morning-brief i Oracle (z progami pewności).

## Decyzja

Przyjęto strategię **"Legacy + New Path"** na najbliższe 6–9 miesięcy.

### Szczegółowe ustalenia

- `evening_extraction` zostaje jako **legacy operational compatibility layer**.
- `p2_parsed` staje się **primary reflection and planning signal**.
- Wszystkie nowe rzeczy idą przez `p2_parsed` / `user_reflection`.
- W `planningDraft` utrzymujemy wyraźny podział:
  - `operational_facts`
  - `user_reflection`

### Sunset Criteria (warunki usunięcia `evening_extraction`)

`evening_extraction` można usunąć dopiero gdy spełnione są **wszystkie** poniższe warunki:

- P2 parser ma stabilną jakość na realnych danych.
- Wszystkie krytyczne operational facts mają odpowiednik w nowym modelu.
- morning/reconciliation/planning działają bez fallbacków do legacy fields przez minimum 30 dni.

### Ownership

- `evening_extraction` = legacy operational compatibility layer
- `p2_parsed` = primary reflection and planning signal

### Migration Trigger

Migrację rozważamy dopiero po:

- zakończeniu Etapu 1,
- ustabilizowaniu signal quality layer,
- wdrożeniu quality audits dla P2 parsera.

### Kluczowa zasada

Nie poświęcamy działającego usage loopa dla „idealnej architektury”.  
Największą wartością systemu jest obecnie **codzienne realne użycie + accumulating behavioral evidence**.

## Konsekwencje decyzji

- Cały dalszy rozwój (w tym Etap 1) zakłada, że nowe rzeczy idą przez `p2_parsed` / `user_reflection`.
- W kodzie części związane z `evening_extraction` powinny być oznaczone jako legacy.
- W dokumentacji (szczególnie w modelu danych) należy zapisać tymczasowy charakter tego rozwiązania.

## Akceptacja

**Strategia „Legacy + New Path” – zaakceptowana.**

Data: Czerwiec 2026

---

*Decyzja zapisana w folderze `docs/direction/` jako DECYZJA_001_DUALIZM.md*