# Vanguard OS — Product Principles

> Guardrail document for feature decisions, architecture reviews, and AI behavior.
> Last updated: 2026-05-18

---

## Core Principle

Vanguard OS nie jest AI-psychologiem ani cyfrowym bliźniakiem.

To system **behavioral instrumentation** i **evidence-based self-observation**.

Jego zadaniem jest utrzymywanie ciągłości obserwacji, której ludzki mózg sam nie utrzymuje — nie odkrywanie "prawdy o użytkowniku".

---

## 1. Evidence over interpretation

System nie mówi:
> "To jesteś Ty."

System mówi:
> "To wystąpiło X razy w Y dniach."

**Inference ≠ truth.**

Każdy insight musi mieć:
- źródło (`source`)
- częstotliwość (`count`)
- poziom pewności (`confidence`)
- zakres danych (`date range`)
- status: `inferred` vs `confirmed`

Bez tych atrybutów — insight nie istnieje jako fakt, tylko jako hipoteza.

---

## 2. Confirmed data gate

Pattern detection działa wyłącznie na `confirmed_friction_events`:

```sql
review_status IN ('good', 'user_confirmed', 'user_corrected')
```

Raw `inferred` events **nigdy** nie mogą tworzyć trwałych wzorców ani wchodzić do analiz behawioralnych bez przejścia przez human review.

To nie jest technikalia. To mechanizm epistemicznej obrony systemu.

---

## 3. User correction is signal

> "To nie jestem ja" jest wartościową odpowiedzią.

Odrzucenie patternu przez użytkownika to dane, nie błąd systemu.

- `user_corrected` → zwiększa jakość datasetu
- `needs_manual_review` → sygnał niskiej pewności
- Correction loop jest równie ważny jak detection loop

System który można skutecznie poprawić buduje zaufanie. System który zawsze "ma rację" — niszczy je.

---

## 4. Observation Mode first

Kolejność jest nienaruszalna:

**Najpierw:**
- zbieranie surowych danych
- precision i recall
- retention użytkownika
- jakość reconciliation

**Dopiero później:**
- coaching
- interwencje
- predykcje
- rekomendacje

Skakanie do interpretacji bez dobrego datasetu to droga powrotna do Oracle hallucination era.

---

## 5. No semantic inflation

System nie może:
- psychoanalizować na podstawie małego datasetu
- nadawać ukrytych znaczeń jednostkowym zdarzeniom
- łączyć eventów w "wzorzec" bez evidence threshold
- tworzyć narracji o użytkowniku bez jego korekty

**Minimalny próg dla pattern claim:**
- ≥ 3 potwierdzone eventy tego samego typu
- w co najmniej 2 różnych kontekstach czasowych
- `confidence >= 0.75` lub `review_status = good`

---

## 6. Resource data is separate from friction data

`friction_events` odpowiadają na pytanie:
> Gdzie pojawia się koszt / tarcie?

`resource_observations` odpowiadają na pytanie:
> Co stabilizuje / zasila / podnosi sprawczość?

**Resource observations nie są pattern candidates dla problemów.**

Używać wyłącznie do korelacji:
- `resource_type` × `day_score`
- `resource_type` × `friction_count`
- `resource_type` × `sleep/readiness`

Wdzięczność i stabilizatory są dowodem zasobu — nie dowodem tarcia.

---

## 7. Trust through transparency

Każde miejsce gdzie system prezentuje insight powinno pokazywać:

```
Źródło: vanguard_stream → auto-classify
Zdarzenia: 4 z ostatnich 14 dni
Pewność: 0.65 (inferred)
Status: oczekuje na review
```

Użytkownik musi zawsze wiedzieć:
- czy insight jest `inferred` czy `confirmed`
- na ilu zdarzeniach bazuje
- kiedy dane zostały zebrane

---

## 8. No total life control

Vanguard nie ma być:
- symulatorem samodoskonalenia
- dashboardem aspiracji
- AI wyrocznią
- coachem osobistym
- systemem gamifikacji zachowań

Ma pomagać:
- utrzymywać kierunek
- widzieć powtarzalne wzorce
- zmniejszać samooszukiwanie
- szybciej zauważać spirale zachowań

Zakres jest ograniczony celowo.

---

## 9. The real success metric

Nie: ilość eventów, embeddings, insightów, grafów.

**Prawdziwe KPI:**

| metryka | co mierzy |
|---|---|
| Retention | Czy użytkownik odpowiada po 14 dniach? |
| Precision | Czy confirmed events są faktycznie poprawne? |
| Correction rate | Jak często użytkownik koryguje system? |
| Friction fatigue | Czy system zaczyna męczyć? |
| Behavioral usefulness | Czy choć raz uniknął znanego patternu? |

**Najważniejszy moment produktu:**

> Użytkownik ufa danym bardziej niż chwilowej narracji —
> ale nadal zachowuje możliwość korekty systemu.

---

## What Vanguard OS is NOT

Filtr dla przyszłych feature requestów. Jeśli propozycja wpada w którąś z poniższych kategorii — wymaga bardzo mocnego uzasadnienia.

| ❌ Nie jest | Dlaczego |
|---|---|
| AI-psycholog | Brak klinicznych podstaw, ryzyko Barnum effect |
| Personality profiler | Małe datasety → pewna nadinterpretacja |
| Coach mode | Rekomendacje bez outcome engine = zgadywanie |
| Gamification layer | Zmienia motywację z intrinsic na extrinsic |
| Prediction engine | Predykcje bez validated patterns = halucynacja |
| Total life tracker | Scope creep zabija retention |
| "Digital twin" | Zbyt duże obietnice, zbyt mały dataset |
| Automatic insight generator | Bez human gate → semantic inflation |
| Therapy replacement | Poza zakresem etycznym i technicznym |

---

## Pułapki epistemiczne do pilnowania

**Barnum effect** — użytkownik zaakceptuje każdy "insight" który brzmi trafnie.
Obrona: pokazywać liczby, nie narracje.

**Confirmation bias** — system znajdzie pattern jeśli będzie szukał.
Obrona: evidence threshold, correction loop, falsifiability.

**Pattern projection** — mały dataset + silny model = pewne halucynacje.
Obrona: `confirmed_friction_events` gate, confidence score.

**Narracja > dane** — łatwiej uwierzyć w historię niż w tabelę.
Obrona: zawsze pokazywać source + count + confidence.

---

## Zasada implementacyjna

Przed dodaniem każdego nowego feature'a:

1. Czy to zbiera dane lepiej?
2. Czy to pomaga użytkownikowi korygować system?
3. Czy to nie generuje inferencji bez evidence?
4. Czy to nie zwiększa psychologicznego ciężaru systemu?

Jeśli odpowiedź na 3 lub 4 brzmi "tak" — feature wymaga dodatkowego uzasadnienia.
