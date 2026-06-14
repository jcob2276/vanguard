# Vanguard OS - kanoniczna specyfikacja produktu i architektury

Status dokumentu: 2026-05-15
Cel: ten plik ma byc jednym zrodlem kontekstu dla GPT/Claude/Codex/devow. Ma tlumaczyc, co budujemy, jak dziala obecny system, co jest juz wdrozone, czego brakuje i w jakim kierunku produkt ma isc.

---

## 1. Krotka definicja

Vanguard OS to prywatny system pamieci, analizy i interwencji dla jednego uzytkownika: Jakuba.

Nie jest to zwykly pamietnik, chatbot, tracker nawykow ani aplikacja produktywnosciowa. Docelowo ma byc:

**prywatnym systemem pamieci i interwencji, ktorego celem jest wykrywanie otwartych petli, powtarzalnych blokad i rozjazdow miedzy deklarowanym zyciem a realnym zachowaniem, a potem proponowanie minimalnych ruchow domykajacych.**

Najkrotsza wersja:

> Vanguard ma lapac Jakuba wtedy, gdy odkleja sie od wlasnych zasad, celow i rzeczywistosci.

---

## 2. Najwazniejsze rozroznienie produktowe

Vanguard nie ma byc tylko "interaktywnym pamietnikiem".

Pamietnik:

- zapisuje, co sie wydarzylo,
- pozwala wrocic do przeszlosci,
- ma wartosc sentymentalna i refleksyjna.

Vanguard:

- zapisuje epizody,
- rozpoznaje fakty, hipotezy, cele, feedback, uniki i decyzje,
- laczy je z czasem, stanem biologicznym i wynikami,
- wykrywa powtarzalne wzorce,
- konfrontuje deklaracje z zachowaniem,
- proponuje minimalna interwencje.

Docelowa wartosc nie brzmi:

> "Bot zna moja historie."

Tylko:

> "System pokazuje, ktore petle w moim zyciu wciaz sa otwarte, co je podtrzymuje i jaki najmniejszy ruch moze je domknac."

---

## 3. Produkt koncowy - mentalny model

Najlepszy opis:

**Personal Operating Mirror / System Lustrzanej Egzekucji**

System sklada sie z pieciu warstw:

1. **Life Context**
   - historia zycia,
   - rodzina,
   - relacje,
   - wazne wydarzenia,
   - dawne okresy pracy/studiow,
   - rzeczy, ktore moga pozniej okazac sie istotne.

2. **Open Loops**
   - rzeczy odkladane 4-7 lat,
   - stare ambicje,
   - niedomkniete decyzje,
   - powtarzajace sie "musze kiedys",
   - pytanie: czy to nadal jest moje, czy to martwa fantazja?

3. **Execution Mirror**
   - sprzedaz,
   - praca,
   - Plan dnia,
   - feedback od zespolu,
   - uniki,
   - zachowania,
   - realne wyniki,
   - stan ciala.

4. **Belief & Principles Layer**
   - Transurfing,
   - rozmowy z Bogiem,
   - mentorzy,
   - Rafal Mazur,
   - zasady sprzedazy,
   - wlasne standardy Jakuba.

5. **Intervention Engine**
   - jedno pytanie,
   - jeden ruch,
   - jedno cwiczenie,
   - jedna konfrontacja,
   - nie esej, nie kazanie, nie "AI ma cos do powiedzenia".

Docelowy graf egzekucji:

```text
Zasada -> Deklaracja -> Zachowanie -> Wynik -> Hipoteza -> Interwencja
```

To jest wazniejsze niz prosty graf typu:

```text
Jakub -> zna -> X
Jakub -> lubi -> Y
```

---

## 4. Czym Vanguard nie jest

Vanguard nie jest:

- terapeuta,
- wyrocznia zyciowa,
- systemem diagnozy psychologicznej,
- narzedziem do wmawiania uzytkownikowi prawd o nim,
- magicznym coachem,
- miejscem na dowolne halucynacje LLM-a,
- pamietnikiem bez celu operacyjnego.

Zasada bezpieczenstwa poznawczego:

> Vanguard nie ma mowic "prawdy o zyciu". Ma pokazywac, kiedy deklarowane zasady, cele i zachowanie Jakuba sie rozjezdzaja.

Przyklad zly:

```text
Masz lek przed odrzuceniem, bo w dziecinstwie wydarzylo sie X.
```

Przyklad dobry:

```text
Hipoteza: w ostatnich 5 epizodach zwiazanych ze sprzedaza pojawia sie unik przed ocena. Evidence: rozmowy z 12.05, 14.05, 16.05. Confidence: 0.62. Pytanie walidujace: czy czujesz spadek kontroli, gdy masz zadac bezposrednie pytanie o decyzje?
```

---

## 5. Glowny problem, ktory system ma rozwiazywac

Jakub ma duzo refleksji, ambicji, wiedzy i koncepcji, ale czesto problemem nie jest brak mysli. Problemem jest:

- brak domykania petli,
- mentalne proby zamiast realnego dzialania,
- uciekanie w bezpieczna produktywnosc,
- rozjazd miedzy deklaracja a zachowaniem,
- powtarzanie tych samych bledow,
- gubienie feedbacku,
- brak trwaĹ‚ego, zewnetrznego systemu korekty kursu.

Vanguard ma nie tyle "motywowac", ile:

- zapamietywac,
- porzadkowac,
- laczyc,
- wykrywac powtorzenia,
- zadawac celne pytania,
- wskazywac minimalny nastepny ruch.

---

## 6. Przyklad wartosci praktycznej

Slaby tryb pamietnika:

```text
5 miesiecy temu czules stres przed sprzedaza.
```

Dobry tryb Vanguard:

```text
To jest czwarty raz w tym miesiacu, kiedy mowisz o sprzedazy, ale realnie raportujesz przygotowania, analize albo budowanie narzedzia. Nie widze ekspozycji na rynek.

Hipoteza: uciekasz w kontrolowalne srodowisko, bo sprzedaz daje natychmiastowa ocene.

Minimalny ruch: dzisiaj jedna rozmowa, w ktorej po obiekcji ceny robisz 2 sekundy pauzy i zadajesz jedno pytanie zamiast sie tlumaczyc.
```

---

## 7. Dane, ktore warto zbierac

Nie trzeba nagrywac wszystkiego. Najwieksza wartosc maja momenty tarcia.

Wysoka wartosc danych:

- uniknalem czegos,
- zrobilem cos mimo oporu,
- dostalem feedback,
- cos mnie zabolalo,
- poczulem ambicje,
- sklamalem sobie,
- mialem dobry stan,
- mialem zly stan,
- podjalem decyzje,
- nie zrobilem tego, co mialem,
- zauwazylem powtarzalny wzorzec,
- ktos powiedzial mi cos waznego,
- mialem rozmowe sprzedazowa,
- mialem rozmowe relacyjna,
- wrocila stara petla,
- cos mnie ciagnie od lat.

Przydatne prefiksy / kategorie:

```text
## historia
## cele
## sprzedaz
## relacje
## pieniadze
## decyzja
## feedback
## po rozmowie
## tarcie
## open loop
## zasada
## wieczorny zrzut
```

Minimalny format dobrej glosowki:

```text
Sytuacja:
Co chcialem zrobic:
Co faktycznie zrobilem:
Gdzie ucieklem:
Co czulem w ciele:
Jaki byl wynik:
Jedna rzecz do poprawy:
```

Format dla sprzedazy:

```text
Call z leadem.
Cel: zadac pytania i nie tlumaczyc ceny.
Zrobilem: mowilem za szybko, wszedlem w tlumaczenie.
Obiekcja: za drogo.
Moja reakcja: zaczalem udowadniac wartosc.
Wynik: brak decyzji.
Feedback: nastepnym razem pauza 2 sekundy i pytanie "w porownaniu do czego?".
```

---

## 8. Obecny stack technologiczny

Frontend:

- React + Vite,
- Tailwind CSS,
- dashboard webowy,
- komponenty m.in. DataHub, BrainHealth, MentorChat / Oracle UI, Oura, Plan dnia.

Backend:

- Supabase Postgres,
- Supabase Edge Functions,
- pgvector,
- pg_cron / pg_net w wybranych miejscach,
- RLS na tabelach publicznych.

AI:

- DeepSeek do rozmowy / reasoning / ekstrakcji,
- OpenAI embeddings (`text-embedding-3-small`),
- OpenAI Whisper lub transkrypcja glosu przez integracje Telegram/Whisper,
- GPT judge/eval okresowo do ewaluacji.

Kanaly wejscia:

- Telegram,
- glosowki,
- tekst,
- Oura,
- Yazio / nutrition,
- ActivityWatch / footprint,
- Plan dnia,
- reczne wpisy.

---

## 9. Kluczowe tabele

Najwazniejsze tabele systemu:

### Pamiec i graf

- `vanguard_stream`
  - strumien epizodow: glosowki, mysli, notatki, wydarzenia,
  - powinien byc traktowany jako wazna warstwa epizodyczna.

- `vanguard_raw_events`
  - niezmienny dziennik surowych zdarzen,
  - najwazniejsza decyzja architektoniczna dla systemu na lata,
  - pozwala za 6-12 miesiecy reprocessowac stare dane lepszym modelem.

- `vanguard_knowledge`
  - semantyczna baza wiedzy,
  - chunkowane fakty, wnioski, summary, wiedza,
  - ma embeddingi.

- `vanguard_entity_links`
  - knowledge graph,
  - triady: source_entity, relation, target_entity,
  - zawiera status, provenance, temporalnosc, source_episode_id,
  - rdzen GraphRAG.

- `vanguard_relation_ontology`
  - whitelist kanonicznych relacji,
  - DB-level guard ma blokowac nowe smieciowe relacje.

- `vanguard_entity_aliases`
  - aliasy encji,
  - np. Kuba/Jakub/uzytkownik powinny prowadzic do jednej encji kanonicznej.

### Oracle i ewaluacja

- `vanguard_oracle_runs`
  - czarna skrzynka kazdego zapytania,
  - zapisuje query, intent, answer, confidence, claims, sources, retrieved_context, state_vector.

- `vanguard_eval_questions`
  - pytania ewaluacyjne,
  - kategorie: fact_recall, temporal_recall, relation_reasoning, grounded_biometrics, abstention.

- `vanguard_eval_results`
  - wyniki evali.

### Biometria i zachowanie

- `vanguard_daily_aggregates`
  - dzienny snapshot stanu: sen, HRV, egzekucja, stan,
  - wazne dla baseline i korelacji.

- `oura_daily_summary`
  - surowe / polsurowe dane Oura.

- `daily_wins`
  - Plan dnia, wykonanie dnia, journal/mood.

- `vanguard_footprint`
  - aktywnosc desktopowa / digital footprint.

### Preferencje, fundament, zasady

- `user_fundament`
  - glowny fundament tozsamosci / profil,
  - ma byc tlem operacyjnym, nie tekstem recytowanym w kazdej odpowiedzi.

- `vanguard_preferences`
  - preferencje stylu odpowiedzi,
  - np. nie zaczynac od danych osobowych.

- przyszle / docelowe:
  - `principles`,
  - `goals`,
  - `commitments`,
  - `friction_events`,
  - `feedback_events`,
  - `hypotheses`,
  - `interventions`,
  - `open_loops`.

---

## 10. Edge Functions - obecna rola

### `vanguard-telegram`

Brama Telegrama.

Odpowiada za:

- odbieranie tekstu i glosu,
- transkrypcje,
- rozpoznanie prefiksow,
- zapis do streamu / knowledge,
- wywolanie Oracle dla pytan,
- routing dlugich tresci przez ingest pipeline.

Wazne zasady:

- zwykla glosowka bez pytania powinna byc zapisem epizodu, nie pytaniem do Oracle,
- pytania moga uzywac `?`,
- tryb glebszy moze uzywac `!!`,
- dlugie tresci nie powinny isc jako jeden rekord do `vanguard_knowledge`; powinny isc przez chunking / ingest.

### `ingest-vault-log`

Pipeline do dluzszych tresci.

Docelowo:

- przyjmuje dlugie transkrypcje,
- dzieli na chunki,
- robi embeddingi per chunk,
- zapisuje epizody / knowledge,
- uruchamia ekstrakcje triad.

### `vanguard-architect`

Budowniczy grafu.

Odpowiada za:

- ekstrakcje triad z `vanguard_stream` / knowledge,
- provenance: `source_episode_id`,
- temporalnosc: `observed_at`, `valid_from`, `valid_until`,
- uzycie ontologii relacji,
- fallback deterministic dla prostych przypadkow,
- reprocessing/backfill.

Docelowo musi byc:

- odporny na smieciowe relacje,
- zgodny z whitelist DB,
- odpalany automatycznie po waznych epizodach albo przez cron.

### `vanguard-oracle`

Glowny silnik odpowiedzi.

Odpowiada za:

- klasyfikacje intencji,
- retrieval z vector DB,
- retrieval z grafu,
- HippoRAG-like seed expansion,
- skladanie kontekstu,
- odpowiedz dla Telegram/UI,
- structured output: answer, confidence, claims, sources,
- zapis audytu do `vanguard_oracle_runs`,
- memory loop / extraction w tle.

Wazna zasada:

> Oracle nie ma recytowac danych tozsamosciowych. Ma uzywac ich jako tla, tylko gdy sa istotne dla pytania.

### `vanguard-analyst`

Analiza okresowa.

Docelowo nie powinien byc "psychologizujacym promptem". Powinien konsumowac strukturalne dane:

- epizody,
- cele,
- feedback,
- anomalie,
- biometryczne spadki,
- wykonanie Planu dnia,
- powtarzalne motywy.

Ma generowac:

- hipotezy,
- pytania walidujace,
- propozycje interwencji,
- nie arbitralne diagnozy.

### `vanguard-eval-runner`

Runner ewaluacji.

Odpowiada za:

- odpalanie testow z `vanguard_eval_questions`,
- ocenianie odpowiedzi przez judge model,
- zapis wynikow,
- raporty per kategoria.

Obecny baseline z ostatniego pelnego evala:

```text
60/60 pytan
Pass: 43/60 = 71.7%
Avg score: 0.768

abstention:            9/10  (90%)
temporal_recall:       10/13 (77%)
fact_recall:           11/17 (65%)
relation_reasoning:    6/10  (60%)
grounded_biometrics:   7/10  (70%)
```

---

## 11. Retrieval i graf - obecny kierunek

Obecna architektura idzie w kierunku:

- Graphiti-like temporal knowledge graph,
- HippoRAG-like associative retrieval,
- hybrid retrieval: vector + graph + recent stream + state vector,
- provenance-first answers,
- eval-driven iteration.

Wdrozone / czesciowo wdrozone:

- `source_episode_id` dla krawedzi grafu,
- temporalne pola typu `valid_from`, `valid_until`, `status`,
- singleton relations: relacje, ktore nie powinny miec wielu aktywnych wartosci naraz,
- deprecacja starych faktow zamiast delete,
- relation ontology,
- DB-level relation guard,
- entity aliases,
- quarantine legacy graph edges,
- eval harness,
- oracle audit log,
- raw events.

Wazna zasada:

> Nie usuwac historii. Quarantine/deprecate zamiast delete.

Przyklad:

```text
Jakub -> studiowal -> Analiza Danych       status: historical
Jakub -> studiuje -> Cyberbezpieczenstwo   status: active
```

Nie wolno mieszac aktualnych relacji z historycznymi.

---

## 12. Ontologia relacji

Relacje musza byc kontrolowane.

Problem, ktory juz wystapil:

- graf mial wiele smieciowych relacji,
- np. `uzytkownik`, `osoba`, `Jakub` jako osobne encje,
- relacje w roznych jezykach i formach,
- aktualne relacje uzywane do historii.

Poprawny kierunek:

- whitelist relacji w DB,
- Architect musi korzystac z dozwolonej listy,
- DB trigger / constraint odrzuca relacje spoza ontologii,
- stare smieci sa deprecated/quarantined,
- encje maja aliasy i canonical forms.

Relacje historyczne musza istniec osobno:

- `pracowal_w`,
- `studiowal`,
- `uczestniczyl_w`.

Relacje aktualne:

- `pracuje_w`,
- `studiuje`,
- `mieszka_w`,
- `ma_cel`,
- `ma_relacje_z`.

Hipotezy nie powinny byc zwyklymi faktami.

Zle:

```text
Jakub -> unika -> relacji
```

Lepsze:

```text
hypothesis:
  claim: Jakub moze unikac ekspozycji relacyjnej, gdy czuje ryzyko oceny.
  evidence_for: [...]
  evidence_against: [...]
  confidence: 0.62
```

---

## 13. Warstwa hipotez

To jedna z najwazniejszych rzeczy do rozwoju.

System musi rozdzielac:

1. **Fakty**
   - "Babcia mieszka w Krosnie."
   - "Jakub pracowal w pizzerii."

2. **Deklaracje**
   - "Chce nauczyc sie sprzedazy."
   - "Wierze, ze Transurfing jest wazna rama."

3. **Obserwacje**
   - "W tej glosowce Jakub mowil o unikaniu telefonu."

4. **Feedback z zewnatrz**
   - "Zespol powiedzial, ze Jakub mowi za szybko."

5. **Hipotezy**
   - "Jakub moze uciekac w kodowanie, gdy sprzedaz wywoluje ocene."

6. **Interwencje**
   - "Przez 5 rozmow rob pauze 2 sekundy po obiekcji."

Bez tego system bedzie mieszal prawde, interpretacje i coaching.

---

## 14. Proaktywnosc - jak ma dzialac

System nie powinien gadac caly czas.

Zasada:

> Maksymalnie 1-2 proaktywne interwencje dziennie, tylko gdy jest powtarzalny wzorzec albo jasny rozjazd.

Codziennie / okresowo system powinien pytac sam siebie:

- Co Jakub deklaruje, a czego nie robi?
- Co pojawia sie trzeci raz?
- Gdzie jest rozjazd miedzy zasada a zachowaniem?
- Gdzie dane z ciala tlumacza spadek?
- Gdzie dane z ciala sa wymowka?
- Co jest teraz najbardziej dzwigniowym pytaniem?
- Jaki jeden ruch ma najwiekszy stosunek wartosci do oporu?

Przyklad dobrej interwencji:

```text
Widze trzeci dzien z rzedu ten sam uklad:
mowisz o sprzedazy, ale logujesz glownie kodowanie i analize systemu.

Hipoteza: uciekasz w kontrolowalne srodowisko, bo sprzedaz daje natychmiastowa ocene.

Jedno pytanie:
czy dzisiaj chcesz faktycznie trenowac sprzedaz, czy tylko robic rzeczy wokol sprzedazy?
```

Przyklad zly:

```text
Musisz byc bardziej zdyscyplinowany. Twoj cien sabotuje Twoj potencjal.
```

---

## 15. Transurfing, Bog, mentorzy i frameworki

To ma byc warstwa interpretacyjna, nie dogmatyczna.

System powinien znac:

- zasady Transurfingu,
- rozmowy z Bogiem / duchowe ramy Jakuba,
- mentorow,
- Rafala Mazura,
- frameworki sprzedazy,
- dykcje,
- ekspozycje spoleczna,
- zasady pracy nad granicami.

Ale ma ich uzywac tylko w relacji do danych Jakuba.

Zle:

```text
Transurfing mowi, zebys obnizyl waznosc.
```

Dobre:

```text
Od 4 dni mowisz o obnizaniu waznosci, ale 6 razy wracasz do kontroli wyniku i napiecia wokol tego samego tematu. Hipoteza: deklarujesz Transurfing, ale operacyjnie grasz z wysoka waznoscia.

Minimalny ruch: jedna akcja bez sprawdzania efektu przez 24h.
```

Warstwa mentorow ma sens dopiero jako:

```text
problem Jakuba -> podobny wzorzec w historii -> framework mentora -> mala interwencja
```

Nie jako baza cytatow.

---

## 16. Frontend - docelowe role aplikacji

Obecny frontend ma dashboardy i komponenty. Docelowo UI powinno bardziej wspierac nastepujace widoki:

### 1. Flight Recorder

Timeline epizodow:

- glosowki,
- decyzje,
- feedback,
- stan biologiczny,
- wynik dnia,
- wazne rozmowy.

### 2. Evidence View

Dla kazdej odpowiedzi Oracle:

- zrodla,
- epizody,
- snippets,
- confidence,
- czy to fakt, czy hipoteza.

### 3. Open Loops

Lista petli:

- od kiedy istnieje,
- ile razy wracala,
- co blokuje,
- czy nadal jest aktualna,
- nastepny minimalny test.

### 4. Execution Mirror

Rozjazdy:

- deklarowane cele vs realne zachowanie,
- Plan dnia vs glosowki,
- feedback vs dzialania,
- sprzedaz vs przygotowania.

### 5. Weekly Strategy Review

Nie "podsumowanie tygodnia", tylko:

- co sie powtarzalo,
- co zostalo unikniete,
- co ruszylo do przodu,
- jaki jeden wzorzec atakujemy w kolejnym tygodniu.

### 6. Graph Explorer

Nie ladny obrazek dla samego grafu.

Widok ma pokazywac:

- klastry,
- provenance,
- aktywne vs historyczne relacje,
- hipotezy,
- open loops,
- konflikty.

---

## 17. Koszty i limity

Stan bazy sprawdzony 2026-05-15:

- rozmiar DB: ok. 59 MB,
- limit Supabase Free: 500 MB database size,
- zapas: ok. 440 MB.

Najwieksze tabele:

- `vanguard_entity_links`: ok. 21 MB,
- `vanguard_knowledge`: ok. 11 MB,
- `vanguard_oracle_runs`: ok. 4.4 MB,
- `vanguard_stream`: ok. 3.6 MB.

Przy 10 minutach danych dziennie:

- konserwatywnie: 10-20 MB / miesiac,
- normalnie: 20-40 MB / miesiac,
- agresywnie: 50-80 MB / miesiac.

Wniosek:

- Free tier powinien wystarczyc na miesiace, prawdopodobnie okolo roku przy higienie danych,
- 500 MB nie jest sciana, tylko sygnal do retencji i archiwizacji,
- nie trzymac audio w Postgresie,
- raw audio trzymac lokalnie / Drive / object storage,
- w Postgresie trzymac indeks, transcript, chunks, embeddings, graph.

Retencja:

- `raw_events` zostaja,
- wazne transkrypcje zostaja,
- graf zostaje, ale czysty,
- `vanguard_oracle_runs` pelne np. 30-90 dni, potem kompresja,
- stare evale i retrieved_context archiwizowac/usuwac,
- deprecated smieci w grafie kompresowac / archiwizowac.

---

## 18. Co jest obecnie najmocniejsze

1. Realny strumien danych z Telegrama/glosu.
2. Supabase jako backend.
3. Embeddingi i semantic search.
4. Knowledge graph z provenance.
5. Temporalny kierunek grafu.
6. Eval harness.
7. Oracle audit log.
8. Warstwa biometryczna Oura / daily aggregates.
9. Mozliwosc reprocessingu dzieki raw events.
10. Bardzo jasny single-user use case.

---

## 19. Co jest obecnie najslabsze / ryzykowne

1. Hipotezy nadal nie sa pelnoprawna oddzielna warstwa.
2. Proaktywny intervention engine jest bardziej koncepcja niz pelny system.
3. Graf wymaga dalszej higieny: duplikaty, relacje historyczne vs aktualne, aliasy.
4. Long-form ingest musi byc konsekwentnie chunkowany.
5. Oracle moze nadal czasem zbyt pewnie interpretowac dane.
6. Warstwa mentorow moze latwo stac sie generatorem porad zamiast systemem dobranych interwencji.
7. UI jeszcze nie odzwierciedla w pelni nowej definicji produktu.
8. Brakuje pelnej warstwy open loops / commitments / interventions.
9. Evale mierza pamiec i groundedness, ale jeszcze slabo mierza realna wartosc zyciowa.
10. Potrzebna polityka retencji danych.

---

## 20. Najwazniejsze moduly do zbudowania dalej

### A. Open Loops

Cel:

- przechowywac rzeczy, ktore wracaja latami,
- odrozniac martwa fantazje od prawdziwego celu,
- wymuszac minimalny test.

Struktura:

```text
open_loop_id
title
first_seen
last_seen
status: active / paused / closed / abandoned
why_it_matters
blocking_pattern
evidence_count
next_minimal_test
```

### B. Hypothesis Layer

Cel:

- oddzielic interpretacje od faktow.

Struktura:

```text
hypothesis_id
claim
scope
confidence
evidence_for[]
evidence_against[]
last_validated_at
status: active / weakened / rejected / confirmed
```

### C. Feedback Events

Cel:

- feedback od zespolu/ludzi nie moze ginac.

Przyklady:

- "mowisz za szybko",
- "za bardzo sie tlumaczysz",
- "unikasz kontaktu wzrokowego",
- "wchodzisz w szczegoly zamiast zamykac".

### D. Decision Log

Cel:

- decyzje maja miec kontekst, zalozenie i pozniejszy wynik.

Struktura:

```text
decision
context
expected_outcome
actual_outcome
review_date
state_vector_at_decision
```

### E. Intervention Engine

Cel:

- zamieniac wzorzec na maly ruch.

Struktura:

```text
trigger_pattern
intervention
duration
success_metric
result
```

### F. Principle Alignment

Cel:

- sprawdzac rozjazd miedzy zasadami a zachowaniem.

Przyklad:

```text
principle: obnizanie waznosci
observed_behavior: wielokrotne sprawdzanie wyniku / kontroli reakcji
alignment: low
question: czy dzialasz z intencji, czy z kontroli lustra?
```

---

## 21. Roadmapa praktyczna

### Etap 0 - teraz

Cel:

- nie dodawac chaotycznie funkcji,
- zaczac karmic system danymi,
- pilnowac, czy pipeline faktycznie zapisuje stream, chunks, graph, provenance.

Akcje:

- nagrywac 5-10 minut dziennie,
- glownie momenty tarcia,
- raz na tydzien sprawdzic graph/provenance,
- eval co 2-4 tygodnie.

### Etap 1 - 30 dni

Cel:

- sprawdzic, czy system ma wartosc praktyczna.

Metryki:

- czy Oracle pamieta rzeczy sprzed tygodnia,
- czy graph rosnie czysto,
- czy source_episode_id rosnie,
- czy feedback od zespolu jest widoczny,
- czy system pomaga podjac decyzje lub wykonac ruch.

### Etap 2 - 90 dni

Cel:

- wejsc w warstwe open loops / hypotheses / interventions.

Akcje:

- zbudowac tabelaryczne open loops,
- zbudowac hypotheses,
- zbudowac feedback events,
- zbudowac weekly strategy review.

### Etap 3 - 6-12 miesiecy

Cel:

- system zaczyna byc osobista przewaga operacyjna.

Akcje:

- proaktywne interwencje,
- mentor knowledge jako filtr,
- stale evale,
- retencja danych,
- lepszy frontend evidence/open loops.

---

## 22. Jak oceniac, czy to dziala

Nie oceniac po tym, czy odpowiedzi brzmia ladnie.

Oceniac po:

1. Czy system pamieta fakty z konkretnych epizodow?
2. Czy podaje zrodla?
3. Czy odroznia fakt od hipotezy?
4. Czy wykrywa powtarzalne wzorce?
5. Czy wskazuje rozjazd deklaracja-zachowanie?
6. Czy pomaga wykonac maly ruch?
7. Czy po miesiacu widac lepsze decyzje / mniej chaosu?
8. Czy eval rosnie, gdy dodawane sa dane?
9. Czy graf jest czystszy, a nie tylko wiekszy?
10. Czy uzytkownik czuje mniejsze obciazenie glowy?

---

## 23. Najwazniejsza zasada projektowa

Nie budujemy systemu, ktory ma "miec racje".

Budujemy system, ktory ma:

- zachowywac dowody,
- pokazywac wzorce,
- stawiac hipotezy,
- prosic o walidacje,
- proponowac male interwencje,
- i mierzyc, czy te interwencje dzialaja.

To jest roznica miedzy "AI mentorem" a systemem operacyjnym dla zycia.

---

## 24. Instrukcja dla kolejnego AI

Jesli czytasz ten dokument jako GPT/Claude/Codex, przyjmij nastepujace zasady:

1. Nie redukuj Vanguard OS do pamietnika.
2. Nie rob z niego magicznego coacha.
3. Mysl o nim jako o systemie pamieci, dowodow, petli i interwencji.
4. Zawsze rozdzielaj fakty, deklaracje, obserwacje, feedback, hipotezy i interwencje.
5. Nie proponuj kolejnych promptow bez pytania, czy istnieja dane i eval.
6. Nie psychologizuj bez provenance.
7. Nie traktuj starych danych jako aktualnych bez temporal validity.
8. Nie wrzucaj wszystkiego do jednej tabeli "knowledge".
9. Zawsze pytaj: jaka decyzje lub zachowanie ma to poprawic?
10. Najwazniejszy cel: wykrywac i domykac petle, ktore trzymaja Jakuba w miejscu.

Kanoniczne pytanie produktowe:

> Co blokuje Jakuba przed przejsciem z obecnego zycia do zycia, ktore deklaruje, ze chce miec?

Kazda funkcja, tabela, prompt i widok UI powinny byc oceniane przez to pytanie.
