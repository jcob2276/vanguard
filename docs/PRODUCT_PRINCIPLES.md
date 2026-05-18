# Vanguard OS — Product Principles

> Guardrail document for feature decisions, architecture reviews, and AI behavior.
> Last updated: 2026-05-18

> **Stan projektu:** system przestał być naiwny wobec własnych błędów. To nie jest to samo co dojrzałość.
>
> **Ten dokument ma wersje.** Zasady które są tu teraz mogą wymagać zmiany gdy pojawi się outcome tracking, interventional learning, lub 12 miesięcy realnych danych. Epistemiczna dyscyplina oznacza zdolność aktualizowania własnych założeń — nie ich zamrożenie.
>
> **Backlog dokumentu:** dodać sekcję "examples of bad outputs" z realnymi przykładami semantic inflation, creeping interpretation, acceptable uncertainty i epistemic paralysis gdy system będzie miał wystarczająco dużo outputów do pokazania.

---

## Core Principle

**Vanguard OS nie przechowuje "prawdy o użytkowniku".**
**Vanguard OS przechowuje uporządkowane ślady zachowania wraz z poziomem pewności i możliwością korekty.**

To system **behavioral instrumentation** i **evidence-based self-observation**.

Jego zadaniem jest utrzymywanie ciągłości obserwacji, której ludzki mózg sam nie utrzymuje — nie odkrywanie "prawdy o użytkowniku".

---

## Reasoning ≠ Measurement

Sprint 0.7 nie był "cleanupem kodu". Był **rozdzieleniem epistemologicznym warstw systemu**.

**Błąd Oracle era:**
```
inference → memory → retrieval → stronger inference
```
Samowzmacniająca się pętla interpretacji. Oracle wnioskował, zapisywał wnioski jako wiedzę, a potem wnioskował na podstawie własnych wniosków.

**Zdrowy model:**
```
behavior → evidence → confirmation → pattern detection → reasoning
```
Kolejność jest tu wszystkim.

**Podział warstw:**
- `LLM (DeepSeek/Oracle)` = reasoning layer
- `Vanguard pipeline` = behavioral evidence layer

Vanguard nie konkuruje z LLM na polu reasoning.
Vanguard dostarcza LLM dane, których LLM sam nie może zebrać.

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

## Current limitations

> Vanguard obecnie obserwuje ślady zachowania. Nie wnioskuje przyczynowości, nie diagnozuje psychologicznie i nie potwierdza twierdzeń o tożsamości użytkownika.

Konkretnie — system **nie potrafi** jeszcze:

- powiedzieć czy coś się poprawia (brak outcome tracking)
- odróżnić spirali od chwilowego kosztu (brak state transitions)
- stwierdzić że interwencja zadziałała (korelacja ≠ kauzalność)
- podsumować tygodnia/miesiąca jako jednostki analizy (brak behavioral compression)
- powiedzieć "ten pattern jest Twój" z wystarczającym confidence (za mało danych)

Każda z tych rzeczy wymaga minimum 60-90 dni danych i osobnego etapu walidacji.

---

## Known biases in the data

Timestamps i częstotliwość nie są obiektywną prawdą. Vanguard przechowuje **strukturalizowany ślad zachowania** — nie pomiar.

**Selection bias** — logujesz to co zauważysz, pamiętasz, uznasz za ważne. System nie widzi 95% życia, kontekstu, stanów nieuświadomionych.

**Reporting bias** — każdy wpis jest już interpretacją. "Straciłem 3h" może być regulacją emocjonalną, objawem przemęczenia albo rzeczywiście kosztem.

**Metric trap** — system zaczyna optymalizować mierzalne rzeczy, ignorując niemierzalne. Dlatego `resource_observations` istnieje: człowiek nie działa wyłącznie przez redukcję błędów.

System musi pamiętać o tych limitach przy każdym patternie który prezentuje.

---

## Where we are now (honest assessment)

Vanguard OS to **aktualnie**:

- A. Behavioral logging system
- B. Structured reconciliation layer
- C. Evidence-aware pattern groundwork

To już więcej niż journaling. Ale mniej niż "longitudinal behavioral memory".

**Czego jeszcze nie ma:**

| brakujący element | co to oznacza |
|---|---|
| Stable longitudinal patterns | Prawdziwa ciągłość zaczyna się po tygodniach, nie dniach |
| Outcome continuity | System nie widzi czy zmiana zadziałała, czy pattern się zmniejszył |
| State transitions | Brak rozumienia spirali, momentum, przeciążenia jako stanów dynamicznych |
| Behavioral compression | Brak tygodniowych/miesięcznych podsumowań jako jednostek analizy |
| Interventional learning | "Gdy zrobiłeś X, pattern Y zmniejszył się przez 8 dni" — jeszcze nie istnieje |

**Minimum żeby powiedzieć "mamy continuity layer":**
- 60–90 dni danych
- Outcome tracking (czy coś się poprawia)
- Stabilny correction loop (system uczy się false positives)
- Behavioral summarization (nie tylko eventy, ale fazy i trendy)

## The long-term target

Nie: "AI rozumie człowieka."

Tylko:

> **System utrzymuje długoterminową ciągłość zachowania lepiej niż ludzka pamięć.**

GPT/Claude mogą być genialnym reasoning engine w jednej rozmowie — ale nie utrzymują rygorystycznej longitudinal continuity opartej o realne dane użytkownika.

To jest docelowa nisza Vanguarda. Nie reasoning. **Longitudinal behavioral memory.**

Ale to jest aspiracja, nie obecny stan. Największy błąd jaki można zrobić: uwierzyć za wcześnie, że system już rozumie użytkownika.

---

## Weekly output audit

Raz na tydzień — losowa próbka outputów systemu (briefingi, reconciliation summaries, pattern outputs). Pytania:

1. Czy brzmi to jak **pomiar** czy **diagnoza**?
2. Czy każdy claim ma evidence (count, source, date range)?
3. Czy wording sugeruje większą pewność niż dane uzasadniają?
4. Czy system przypisuje cechy tożsamości użytkownika?
5. Czy użytkownik mógłby skutecznie to skorygować?

Jeśli odpowiedź na 1, 3 lub 4 jest "tak" — creeping interpretation wraca. Nie szukać przyczyny w danych. Szukać w promptach, retrieval i wording modelu.

---

## Operational vocabulary

Wspólny język do code review, architecture decisions i wykrywania regresji:

| pojęcie | definicja |
|---|---|
| **semantic inflation** | system nadaje znaczenie jednostkowym zdarzeniom lub łączy eventy w "wzorce" bez evidence threshold |
| **creeping interpretation** | stopniowy powrót psychologicznych narracji przez małe zmiany tonu, wordingu i confidence — bez jednego wyraźnego błędu |
| **temporal collapse** | traktowanie historycznych danych jako aktualnych; brak rozróżnienia między tym co było a tym co jest |
| **reasoning ≠ measurement** | LLM wnioskuje — Vanguard mierzy. Te dwie warstwy nie mogą się mieszać |
| **confirmed gate** | bariera między raw inference a pattern analysis: tylko `review_status = good/user_confirmed/user_corrected` |
| **evidence layer** | `vanguard_stream`, `friction_events`, `daily_reconciliations` — dane z zachowania |
| **reasoning layer** | Oracle/DeepSeek — interpretacja na podstawie evidence layer, nie jego mutator |
| **outcome continuity** | śledzenie czy zmiana zachowania faktycznie zmieniła trajektorię — jeszcze nie istnieje |
| **interventional learning** | "gdy zrobiłeś X, pattern Y zmniejszył się przez N dni" — wymaga outcome continuity |
| **longitudinal behavioral memory** | ciągłość obserwacji przez tygodnie/miesiące — docelowy stan, nie obecny |

---

## The balance: epistemic discipline ≠ epistemic paralysis

Zbyt dużo ostrożności to też failure mode:
- wszystko hedge'owane,
- każdy output ma tyle disclaimerów że przestaje być użyteczny,
- system boi się powiedzieć cokolwiek konkretnego.

**Docelowy format outputu:**

> "W ostatnich 14 dniach pattern X pojawił się 9 razy, głównie po Y. Confidence: low-to-medium. Możesz sprawdzić, czy to trafia."

To: nie udaje prawdy — ale nadal jest użyteczne i actionable.

**Dwa failure modes do pilnowania równocześnie:**

| za dużo interpretacji | za dużo ostrożności |
|---|---|
| semantic inflation | epistemic paralysis |
| identity claims | bezużyteczne hedge'y |
| confidence inflation | brak konkretnych outputów |
| Oracle era | archiwum logów bez wartości |

---

## Red-team epistemiczny (backlog)

Gdy system będzie miał 60+ dni danych — celowe testy graniczne:
- adversarial prompts wywołujące psychoanalizę
- małe sample → czy system tworzy pewne identity claims?
- edge cases reconciliation → czy parser nadinterpretuje?
- sprawdzenie czy confidence rośnie bez nowych danych

Guardrailsie najlepiej poznaje się gdy próbujesz je złamać.

---

## Principles → Technical guardrails

Każda zasada ma odpowiadający constraint techniczny. Bez tego dokument jest tylko intencją.

| zasada | guardrail techniczny | gdzie w kodzie |
|---|---|---|
| confirmed only | `VIEW confirmed_friction_events` filtruje `review_status IN ('good', 'user_confirmed', 'user_corrected')` | SQL migration `sprint_08` |
| reasoning ≠ measurement | Oracle write access do `vanguard_knowledge` i `entity_links` wyłączony | `vanguard-oracle` v103, Sprint 0.7 |
| user correction is signal | `daily_reconciliations` table, `confidence_source = user_corrected` | Sprint 0.8 P1 |
| no semantic inflation | `match_vanguard_content` — max 90 dni, tylko verified knowledge | SQL migration `sprint_07_match_vanguard_content_recency` |
| behavior → evidence → reasoning | `vanguard-architect` friction extraction disabled, tylko `vanguard-auto-classify` jako canonical pipeline | Sprint 0.7 P3 |
| resource ≠ friction | `resource_observations` osobna tabela, nie wchodzi do `confirmed_friction_events` | P2 (pending) |
| no outcome inference | brak `interventional_outcomes` table — system nie twierdzi że X spowodowało Y | stan obecny, intencjonalny |

**Zasada weryfikacji nowego feature'a:**
Przed merge — czy narusza którąś z powyższych linii? Jeśli tak — wymaga eksplicytnej decyzji i aktualizacji tej tabeli.

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

## Feature gate — 3 pytania dla każdego nowego AI capability

Każde nowe AI capability przechodzi przez te pytania przed implementacją:

### 1. Czy to generuje evidence czy inference?
Evidence = dane z zachowania użytkownika, potwierdzone lub confirmowalane.
Inference = wniosek systemu bez twardego potwierdzenia.
Inference jest dozwolony — ale musi być oznaczony jako inference, nie fakt.

### 2. Czy inference może mutować evidence layer?
Jeśli tak — feature jest podejrzany. To był błąd Oracle era.
`inference → memory → retrieval → stronger inference` = samowzmacniająca się pętla.
Inference nie może zapisywać się jako wiedza bez human confirmation.

### 3. Czy użytkownik może skutecznie to skorygować?
Jeśli correction loop nie istnieje lub jest ograniczony — feature wymaga uzasadnienia.
System bez korekty staje się czarną skrzynką generującą niekontrolowane claims.

---

## Creeping interpretation — największe ryzyko operacyjne

Guardrailsie nie łamią się nagle. Wracają powoli, niezauważalnie:

```
mały insight
→ pattern
→ user profile
→ identity graph
→ Oracle era
```

Sygnały ostrzegawcze:
- system zaczyna używać "Twój wzorzec to..." zamiast "to wystąpiło X razy"
- nowy feature "trochę interpretuje" — ale to przecież tylko mały dodatek
- confidence score rośnie bez nowych danych
- agent zaczyna wyprowadzać wnioski których nie można sfalsyfikować

**Finalnym testem guardraila nie jest dokument, prompt ani komentarz w SQL.**
**Tylko output systemu na realnych danych.**

Jeśli output zaczyna brzmieć jak diagnoza psychologiczna — guardrail nie działa, niezależnie od tego co mówi kod.

---

## Zasada implementacyjna

Przed dodaniem każdego nowego feature'a:

1. Czy to zbiera dane lepiej?
2. Czy to pomaga użytkownikowi korygować system?
3. Czy to nie pozwala inference mutować evidence layer?
4. Czy to nie zwiększa psychologicznego ciężaru systemu?

Jeśli odpowiedź na 3 brzmi "tak" — feature jest zablokowany bez eksplicytnej decyzji architektonicznej.
