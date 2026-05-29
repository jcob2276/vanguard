# Vanguard OS — Product Principles

> Guardrail document for feature decisions, architecture reviews, and AI behavior.
> Last updated: 2026-05-18

> **Stan projektu:** system przestał być naiwny wobec własnych błędów. To nie jest to samo co dojrzałość.
>
> **Najlepszy opis systemu:** *behavioral field notes with continuity and correction.*
>
> **Propozycja wartości:** Vanguard nie wygrywa pierwszej sesji. Wygrywa przez longitudinal usefulness — po 90 dniach użytkownik ma lepszy kontakt z własnym trajectory niż kiedykolwiek wcześniej. To jest celowo wolniejsza wartość niż "instant perceived intelligence" (Mindsera, journaling AI). Ryzyko: wymaga konsekwentnego użycia żeby w ogóle zadziałać.
>
> **Earned depth vs simulated depth:** większość AI apps produkuje "AI deeply understands your mind" od pierwszego dnia z 4 wpisami i 2 emocjami. To jest simulated depth — generatywna pewność modelu bez danych. Vanguard buduje earned depth: insight wynikający z czasu, powtarzalności i realnych danych. System nie pompuje głębi której jeszcze nie ma.
>
> **Progressive disclosure of depth:** wartość systemu pojawia się stopniowo — tydzień 1–2 (anchor, reconciliation, reset), tydzień 3–4 (pierwsze powtarzalności), miesiąc 2 (weekly trajectory review, friction/recovery patterns), miesiąc 3 (trajectory-level observations, "od kilku tygodni..."). Każdy etap daje tyle głębi ile uzasadniają dane — nie więcej.
>
> **Ten dokument ma wersje.** Zasady które są tu teraz mogą wymagać zmiany gdy pojawi się outcome tracking, interventional learning, lub 12 miesięcy realnych danych. Epistemiczna dyscyplina oznacza zdolność aktualizowania własnych założeń — nie ich zamrożenie.
>
> **Backlog dokumentu:** dodać sekcję "examples of bad outputs" z realnymi przykładami semantic inflation, creeping interpretation, acceptable uncertainty i epistemic paralysis gdy system będzie miał wystarczająco dużo outputów do pokazania.

---

## Core Principle

**Vanguard OS nie przechowuje "prawdy o użytkowniku".**
**Vanguard OS przechowuje uporządkowane ślady zachowania wraz z poziomem pewności i możliwością korekty.**

**Vanguard minimalizuje interpretację, ale nie eliminuje refleksji.**

System może:
- odzwierciedlać powtarzające się obserwacje (z liczbą wystąpień)
- sugerować praktyki (Transurfing layer, reset prompts)
- podkreślać ciągłość i wzorce dryfu/recovery
- pokazywać trajectory w czasie

System nie może:
- twierdzić psychologicznej pewności
- wnioskować metafizycznej prawdy
- zastępować agency użytkownika
- przedstawiać interpretacji jako obiektywnego faktu

> Poprzednia formuła "System measures behavior. User gives meaning." była zbyt wąska po dodaniu Transurfing layer i reflection layer. Obecna definicja jest dokładniejsza.

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
- AI wyrocznią / mentorem / coachem osobistym
- systemem gamifikacji zachowań
- narzędziem do "poprawy siebie" przez interpretację

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

### Wersja 10/10 (aspiracyjna)

Pełna wersja tej wizji opisana jest tutaj:

→ [docs/VISION_10_10.md](./VISION_10_10.md)

W skrócie: Vanguard przestaje być aplikacją i staje się czymś bliższym zewnętrznemu układowi nerwowemu + pamięci operacyjnej. System nie tylko zapisuje dane — rozumie trajektorię życia w czasie, wykrywa wzorce zanim użytkownik je nazwie i działa jako warstwa anty-self-deception.

Ale to jest aspiracja na wiele lat. Największy błąd: udawać, że jesteśmy już blisko tej wersji.

---

**Bieżący priorytet:** budować solidną, rygorystyczną warstwę dowodów i ciągłości, zanim zaczniemy udawać, że system „zna” użytkownika.

---

## Weekly output audit

Raz na tydzień — losowa próbka outputów systemu (briefingi, reconciliation summaries, pattern outputs). Pytania:

1. Czy brzmi to jak **pomiar** czy **diagnoza**?
2. Czy każdy claim ma evidence (count, source, date range)?
3. Czy wording sugeruje większą pewność niż dane uzasadniają?
4. Czy system przypisuje cechy tożsamości użytkownika?
5. Czy użytkownik mógłby skutecznie to skorygować?

Jeśli odpowiedź na 1, 3 lub 4 jest "tak" — creeping interpretation wraca. Nie szukać przyczyny w danych. Szukać w promptach, retrieval i wording modelu.

**Dodatkowy sygnał ostrzegawczy — telemetry corruption:**
Jeśli wpisy w strumieniu zaczynają brzmieć "lepiej niż życie" — system zaczyna produkować uporządkowaną fikcję. Użytkownik nauczył się pisać pod AI, nie pod rzeczywistość. Frictionless honesty > perfect structure. Brudny, nieskładny, prawdziwy stream jest więcej wart niż pięknie sklasyfikowany performans.

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
| **telemetry corruption** | użytkownik uczy się jak "dobrze wyglądać" przed systemem — wpisy stają się estetyczne ale mniej prawdziwe; behavioral continuity zaczyna się rozpadać |

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

---

## Transurfing Layer Guardrail

Transurfing w Vanguard OS jest warstwą praktyki i intencji, nie warstwą prawdy.

System może używać pojęć: intencja, wahadło, obniżenie ważności, slajd procesu, wybór wariantu — ale tylko jako języka refleksji i działania. System może sugerować praktykę. Nigdy nie może twierdzić metafizycznej pewności.

**System nie może twierdzić:**
- że dane wydarzenie stało się przez wahadło
- że manifestacja zadziałała
- że rzeczywistość wysłała znak
- że energia użytkownika przyciągnęła wynik
- że system zna metafizyczną przyczynę zdarzeń

**Bezpieczna formuła:**
> "Możesz spojrzeć na to przez zasadę X. Co to zmienia w Twoim najbliższym ruchu?"

**Zakazana formuła:**
> "To dowód, że X działa."

**Core rule:**
> System measures behavior. User gives meaning.

Slajd procesu musi dotyczyć procesu, nie fantazji wyniku:
- ✓ "widzę siebie, jak robię 45 minut pracy bez telefonu"
- ✗ "jestem bogaty, pewny siebie i wszystko mi wychodzi"

**Declared intentions w warstwie dowodów (2026-05-29):**
Deklarowane intencje (`vanguard_intentions`: modlitwy, afirmacje, cele) wchodzą do kontekstu Oracle po stronie **DEKLARACJI** osi *deklaracja-vs-działanie* — jako materiał do konfrontacji z faktycznym zachowaniem, nie jako prawda. **Status intencji zmienia wyłącznie użytkownik** (UI); żaden cron ani LLM nie orzeka autonomicznie, że intencja „się zmanifestowała”. Ta sekcja jest SSOT — ma pierwszeństwo nad blankietowym sformułowaniem w `AGENTS.md`/`ARCHITECTURE.md`.

---

## Timezone — zasada wyświetlania

**DB przechowuje UTC — zawsze, bez wyjątku.**

User-facing display:
- każde `answered_at`, `created_at`, `sent_at`, `occurred_at` renderować jako `Europe/Warsaw`
- w raportach Telegram nigdy nie pokazywać surowego UTC bez oznaczenia strefy
- format: `HH:mm Warsaw` lub `DD.MM HH:mm Warsaw` — nie ISO string

**Timestamp metadata > user-stated time:**
Jeśli użytkownik w głosówce mówi "jest 21:30", ale metadata timestamp mówi 23:32 Warsaw — system ufa metadata. Wypowiedź użytkownika o godzinie traktować jako treść (content), nie jako source of truth dla czasu zdarzenia. Użytkownik może się mylić, voice-to-text może zniekształcić, timezone confusion jest częsta.

---

## P2: Positive trajectory signals — improve extraction

Obserwacja z 2026-05-18: pipeline dobrze łapie dryf, avoidance, blokady, self-control breaks. Słabiej łapie recovery, adaptive moves, małe przełamania.

Bez recovery layer weekly review staje się listą defektów zamiast mapą trajectory.

**Cel:** `weekly review = mapa (friction vs recovery), nie lista problemów`

### Do dodania do extraction pipeline (kiedy ≥5 podobnych missów w backlogu):

- **positive_micro_action — social recovery:**
  shifted focus to other person, asked follow-up question, spontaneous check-in

- **adaptive behavioral signals:**
  spontaneous initiative, action despite resistance, interruption of drift

- **recovery anchors:**
  broke scroll, completed anchor despite avoidance, resumed task after friction

**Zasada:** nie "AI detected growth". Tylko small observable positive deviations.

**Kiedy nie robić:** dopóki nie ma ≥5 potwierdzonych miss-ów tego typu w observation backlog poniżej. Nie eskalować do feature sprintu bez danych.

---

## Auto-classify observation backlog

Przypadki gdzie auto-classify nie złapał potencjalnego friction event. Nie naprawiać natychmiast — zbierać przez 2–4 tygodnie żeby zobaczyć czy to failure mode systemowy czy jednostkowy miss.

| data | treść wpisu | dlaczego interesujące | hipoteza przyczyny |
|---|---|---|---|
| 2026-05-18 | "W sumie tak... ten dzień uciekł, jest już 17 prawie" (voice-to-text) | passive drift / time loss, brak agencji | chaotyczny voice-to-text, brak słów-kluczy triggering classifier |

**Sygnał ostrzegawczy — dekoracyjna precyzja:**
Liczby i stany które brzmią precyzyjnie ale nie są mierzone. Przykłady z tego projektu: `confidence: 0.65` (zawsze ta sama wartość niezależnie od jakości odpowiedzi modelu), `valid_until` pisany przez LLM bez progu pewności. Przy każdym sprint review: *czy ta liczba/stan faktycznie coś mierzy, czy tylko wygląda jak pomiar?*

**Kiedy patrzeć:** gdy zebrane ≥5 podobnych przypadków — sprawdzić czy jest wspólny pattern (voice transcription? brak słów-kluczy? długie wpisy?). Dopiero wtedy decyzja o ewentualnym patchu classifiera.

---

## P2 parser — spec i pierwszy sample

### Pola do wyciągnięcia z `user_response`:

| pole | typ | opis |
|---|---|---|
| `day_score` | int 1–5 | "ocena dnia X/10" → normalizuj do 1–5 |
| `biggest_cost` | text | odpowiedź na pytanie 2 |
| `best_move` | text | odpowiedź na pytanie 3 |
| `correction` | text | odpowiedź na pytanie 1 (co system źle zrozumiał) |
| `resource` | text\|null | odpowiedź na pytanie 5 (opcjonalne) |
| `blocker_candidates` | jsonb | surowe — nie klasyfikować, tylko wylistować |
| `parse_confidence` | float | jak pewny jest parser że dobrze podzielił odpowiedź |
| `needs_manual_review` | bool | jeśli odpowiedź chaotyczna / niejednoznaczna |

**Zasada parsera:** użytkownik odpowiada głosówką, nielinearnie, z dygresami. Parser nie wymusza struktury — wyciąga sygnały gdzie są, resztę zostawia w `unparsed_notes`.

### Pierwszy real sample (2026-05-18):

```
day_score: 2/10 → skala 1–5: ~1
biggest_cost: uciekł czas, brak pracy pomimo lekkiego dnia, morning scrolling, opóźniony kurs Cisco (zablokowany dostęp)
best_move: skończony egzamin Cisco
correction: "system nic źle nie zrozumiał, nie dałem dużo danych"
resource: null — "nie mam pojęcia co zasiliło, zjadłem klepsiki w barze mlecznym"
blocker_candidates raw: [późny sen poprzedniego dnia, telefon rano, scrolling, brak kierunku/wizualizacji, dryf, pętla późno-spać→późno-wstać]
parse_confidence: high — odpowiedź linearna mimo voice-to-text
needs_manual_review: false
```

**Obserwacja:** użytkownik sam nazwał "pętlę" (późno spać → późno wstać → scrolling → brak pracy). To nie jest analiza systemu — to user-generated hypothesis. Trafia do `blocker_candidates`, nie do `confirmed_friction_events`. Wymaga powtórzenia w kolejnych dniach zanim stanie się czymkolwiek więcej.
