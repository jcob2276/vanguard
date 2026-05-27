# ETAP 0 – Decyzja: Strategia Dualizmu (evening_extraction vs p2_parsed)

**Data:** Czerwiec 2026  
**Cel:** Podjęcie świadomej decyzji, jak postępować z równoległym istnieniem dwóch parserów wieczornych.

---

## Krótki kontekst

Aktualnie mamy dwa parsery, które częściowo robią podobną robotę:

- `evening_extraction` – starszy parser (wbudowany w reconciliation.ts). Głównie wyciąga fakty operacyjne (artifact, first_90_protected, tension_action_result, phone_first itp.).
- `p2_parsed` – nowszy, dedykowany parser (`reconciliationParser.ts`). Wyciąga przede wszystkim refleksję użytkownika (biggest_cost, best_move, blocker_candidates + metadane pewności).

**Aktualne użycie:**
- `evening_extraction` jest czytane prawie wyłącznie w reconciliation.ts.
- `p2_parsed` jest już używane w reconciliation, planning, morning-brief i Oracle (z progami pewności).

---

## Rekomendowana strategia

**Przyjmujemy wariant „Legacy + New Path” na najbliższe 6–9 miesięcy:**

- `evening_extraction` zostaje jako **legacy** (nie ruszamy tego, co obecnie działa).
- Cały nowy rozwój i ulepszenia idą wyłącznie przez `p2_parsed` / `user_reflection`.
- W `planningDraft` utrzymujemy wyraźny podział (`operational_facts` vs `user_reflection`).
- Za 6–9 miesięcy zaplanujemy migrację najważniejszych pól operacyjnych (artifact, first_90, tension_result) – albo do wzmocnionego P2 parsera, albo do dedykowanego lekkiego parsera operacyjnego.

---

## Dlaczego nie idziemy w szybszą migrację?

- Obecny flow działa stabilnie. Nie chcemy ryzykować destabilizacji reconciliation i planowania.
- `p2_parsed` jest już jakościowo lepszy i ma szersze zastosowanie.
- Chcemy najpierw mocno ogarnąć **Etap 1** (Widoczność Wzorców + Anty-Self-Deception), a dualizm rozwiązać w bardziej przemyślany sposób później.

---

## Co będzie potrzebne po zaakceptowaniu tej strategii

1. Formalne zaakceptowanie tej decyzji.
2. Oznaczenie w kodzie części związanych z `evening_extraction` jako legacy.
3. Zapisanie w dokumentacji tymczasowego charakteru tego rozwiązania.
4. Cały dalszy rozwój (w tym Etap 1) będzie zakładał, że nowe rzeczy idą przez `p2_parsed`.

---

## Decyzja (Zaakceptowana)

**Data decyzji:** Czerwiec 2026  
**Akceptacja:** Użytkownik zaakceptował strategię „Legacy + New Path”.

### Ustalenia zaakceptowane:

- `evening_extraction` zostaje jako **legacy compatibility layer**.
- `p2_parsed` staje się **primary reflection and planning signal**.
- Wszystkie nowe rzeczy idą przez `p2_parsed` / `user_reflection`.
- W `planningDraft` utrzymujemy wyraźny podział:
  - `operational_facts`
  - `user_reflection`

### Sunset Criteria (warunki usunięcia `evening_extraction`)

`evening_extraction` można usunąć dopiero gdy spełnione są wszystkie poniższe warunki:

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