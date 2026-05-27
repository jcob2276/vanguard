# ETAP 0 – Szczegółowe zmapowanie dualizmu (evening_extraction vs p2_parsed)

Data audytu: czerwiec 2026

## 1. Cel tego dokumentu

Dostarczyć **pełne, dokładne zmapowanie** użycia obu parserów wieczornych, żeby można było podjąć świadomą i ostateczną decyzję co do dualizmu przed przejściem do Etapu 1.

## 2. Aktualny stan użycia

### 2.1 evening_extraction

**Gdzie jest zapisywane:**
- `supabase/functions/vanguard-telegram/_handlers/reconciliation.ts` (po starym extractorze)

**Gdzie jest czytane:**
- Prawie wyłącznie w tym samym pliku (`reconciliation.ts`):
  - Budowa wiadomości do użytkownika ("Fakty dnia")
  - Wypełnianie `operational_facts` w `planningDraft`
- Kolumna `first_90_protected` jest dodatkowo zapisywana do dedykowanej kolumny w `daily_reconciliations`

**Inne użycie:** Praktycznie zerowe. Nie jest czytane w Oracle, morning-brief, analyst, weekly-synthesis itp.

### 2.2 p2_parsed

**Gdzie jest zapisywane:**
- `reconciliation.ts` po wywołaniu `parseReconciliationResponse`

**Gdzie jest czytane (aktualny stan):**
- `reconciliation.ts`:
  - Sekcja "Twoja refleksja" w bridge message
  - `user_reflection` w planningDraft
  - `user_named_blockers` w planningDraft
  - Wzbogacanie `reconciliation_notes`
- `planning.ts`:
  - Instrukcja w system promptcie LLM-a planowania jak traktować `user_reflection` i `user_named_blockers`
- `vanguard-morning-brief/index.ts`:
  - `p2Note` w porannym briefie (przy confidence >= 0.5)
- `vanguard-oracle/index.ts`:
  - `lastEveningReflection` (przy confidence >= 0.4)
  - Sekcja "[WCZORAJSZA REFLEKSJA UŻYTKOWNIKA]" w promptcie Oracla

## 3. Porównanie

| Aspekt                        | evening_extraction                  | p2_parsed                                      | Komentarz |
|-------------------------------|-------------------------------------|------------------------------------------------|---------|
| Filozofia                     | Operacyjne fakty ("co się wydarzyło") | Refleksja użytkownika ("co on o tym myśli")   | Różne natury |
| Liczba miejsc odczytu         | Prawie tylko reconciliation         | Kilka miejsc (reconciliation, planning, brief, Oracle) | p2 ma już szersze użycie |
| Jakość promptu                | Średnia / legacy                    | Lepsza, z metadanymi pewności                  | P2 jest nowszy i bardziej świadomy |
| Łatwość rozwoju               | Trudna (stary kod)                  | Łatwiejsza                                     | - |
| Ryzyko przy zmianach          | Średnie (wpływa na bridge + plan)   | Niższe w krótkim terminie                      | - |

## 4. Rekomendacja strategii

**Rekomendowana strategia: "Legacy + New Path"**

1. **Na najbliższe 6-9 miesięcy**:
   - Zostawiamy `evening_extraction` jako legacy.
   - Nie ruszamy istniejącego flow w reconciliation (żeby nie destabilizować działającego procesu).
   - Wszystkie nowe rzeczy, ulepszenia i konsumowanie idą wyłącznie przez `p2_parsed` / `user_reflection`.

2. **W `planningDraft`**:
   - Utrzymujemy wyraźny podział (`operational_facts` vs `user_reflection`) – już częściowo zrobione.

3. **W perspektywie 6-12 miesięcy**:
   - Planujemy migrację najważniejszych pól operacyjnych (artifact, first_90_protected, tension_action_result, phone_first) albo:
     - Do wzmocnionego P2 parsera, albo
     - Do osobnego lekkiego "Operational Facts Parsera" (nowy, czysty).

4. **Długoterminowo (12+ miesięcy)**:
   - Dążymy do jednego mocnego wieczornego parsera lub bardzo dobrze rozdzielonych dwóch parserów z jasnym ownershipem.

## 5. Ryzyka i uwagi

- Jeśli będziemy zbyt długo trzymać dualizm, to kod będzie coraz brudniejszy.
- Migracja operacyjnych faktów do P2 może wymagać zmian w promptach wieczornych (użytkownik będzie musiał mówić o nich bardziej refleksyjnie).
- Warto przed migracją mieć dobry pomiar jakości (żeby wiedzieć, czy nowy parser jest lepszy).

---

**Status:** Zmapowane. Gotowe do podjęcia decyzji.