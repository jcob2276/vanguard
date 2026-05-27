# ETAP 0 – Propozycja Decyzji: Dualizm evening_extraction vs p2_parsed

Data: czerwiec 2026

## 1. Podsumowanie sytuacji

Mamy obecnie dwa równoległe parsery wieczorne:

- `evening_extraction` – stary parser (wbudowany w reconciliation.ts). Wyciąga głównie fakty operacyjne (artifact, first_90_protected, tension_action_result, phone_first, analysis_substitution, tomorrow_first_artifact).
- `p2_parsed` – nowszy, dedykowany parser (`reconciliationParser.ts`). Wyciąga refleksję użytkownika (biggest_cost, best_move, blocker_candidates, day_score, correction, resource + metadane pewności).

**Aktualny stan użycia (po mapowaniu):**

- `evening_extraction` jest czytane **prawie wyłącznie** wewnątrz `reconciliation.ts` (budowa bridge message + `operational_facts` w planningDraft).
- `p2_parsed` jest już konsumowane w:
  - reconciliation.ts (bridge + planningDraft)
  - planning.ts (instrukcja dla LLM-a)
  - vanguard-morning-brief (p2Note)
  - vanguard-oracle (lastEveningReflection + sekcja w promptcie)

## 2. Opcje

### Opcja A – "Legacy + New Path" (rekomendowana)

- `evening_extraction` zostaje jako **legacy** na najbliższe 6–9 miesięcy.
- Nie ruszamy istniejącego flow w reconciliation (bezpieczeństwo).
- Cały nowy rozwój, ulepszenia i konsumowanie idzie wyłącznie przez `p2_parsed` / `user_reflection`.
- W `planningDraft` utrzymujemy wyraźny podział (`operational_facts` vs `user_reflection`).
- W perspektywie 6–12 miesięcy planujemy migrację najważniejszych pól operacyjnych (artifact, first_90, tension_result) — albo do wzmocnionego P2 parsera, albo do dedykowanego lekkiego "Operational Facts Parsera".

**Zalety:**
- Niskie ryzyko destabilizacji działającego procesu.
- Pozwala nam najpierw dobrze ogarnąć pomiar jakości i Etap 1.
- dajemy sobie czas na spokojną decyzję o migracji.

**Wady:**
- Przez pewien czas utrzymujemy dualizm (dług techniczny).

### Opcja B – Szybsza migracja

- Natychmiast zaczynamy prace nad przeniesieniem kluczowych pól operacyjnych do P2 parsera (lub nowego dedykowanego parsera).
- Stosunkowo szybko rezygnujemy z `evening_extraction`.

**Zalety:**
- Szybciej likwidujemy dualizm.
- Mniej długu technicznego w dłuższej perspektywie.

**Wady:**
- Wyższe ryzyko w krótkim terminie (trzeba zmieniać flow, który obecnie działa).
- Wymaga więcej zasobów w najbliższych miesiącach.

## 3. Rekomendacja

**Rekomenduję Opcję A ("Legacy + New Path").**

Uzasadnienie:
- Obecny system działa. Nie ma sensu ryzykować destabilizacji reconciliation i planowania tylko po to, żeby szybciej wyczyścić dualizm.
- `p2_parsed` i tak jest już szerzej konsumowane i ma lepszą jakość (ma `parse_confidence`, `needs_manual_review`, lepszy prompt).
- Etap 1 (Widoczność Wzorców + Anty-Self-Deception) da największą wartość użytkownikowi w najbliższym czasie — tam powinniśmy skupić energię.
- Migrację operacyjnych faktów robimy później, w bardziej przemyślany sposób (po zebraniu danych z pomiaru jakości).

## 4. Proponowany harmonogram (przy Opcji A)

- **Teraz – 3 miesiące**: Legacy mode. Tylko P2 się rozwija. W `planningDraft` utrzymujemy podział.
- **Miesiące 4–8**: Zaczynamy planować migrację najważniejszych pól operacyjnych (decyzja: wzmocnić P2 czy zrobić dedykowany lekki parser operacyjny).
- **Miesiące 9–12**: Migracja + wycofanie `evening_extraction` jako głównego źródła.

## 5. Co trzeba teraz zrobić (jeśli przyjmiemy Opcję A)

1. Formalnie zaakceptować tę strategię.
2. W kodzie wyraźnie oznaczyć części związane z `evening_extraction` jako legacy.
3. W dokumentacji (szczególnie w modelu danych) zapisać, że to jest tymczasowe.
4. Cały dalszy rozwój (w tym Etap 1) zakłada, że nowe rzeczy idą przez `p2_parsed` / `user_reflection`.

---

**Decyzja do podjęcia:**

Akceptujesz rekomendację Opcji A ("Legacy + New Path") na najbliższe 6–9 miesięcy?

Tak / Nie / Chcę inną opcję / Chcę więcej szczegółów przed decyzją.