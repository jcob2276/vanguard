# Vanguard OS — Backlog

Jedyny backlog w repo. Wszystko odłożone, nieukończone lub zaplanowane żyje tutaj —
nie w osobnych plikach per temat. Gdy plan/sesja się kończy, otwarte punkty lądują
tutaj przed skasowaniem pliku planu (patrz `AGENTS.md`, sekcja "Reguły dokumentacji").

**Przed kodem:** `AGENTS.md` → `docs/ARCHITECTURE.md` → `supabase/functions/README.md`

**Aktualny stan pracy w toku (co robi agent teraz):** [`docs/agent/ACTIVE_WORK.md`](docs/agent/ACTIVE_WORK.md).
Ten plik (`BACKLOG.md`) to kolejka — rzeczy jeszcze nierozpoczęte albo wstrzymane.

---

## Jak z tym pracować

- Odhaczaj `[x]` po zamkniętym punkcie, nie usuwaj wiersza od razu — usuń przy najbliższym porządkowaniu sekcji.
- Nowy punkt dopisuj do właściwej części, nie na końcu pliku.
- Części I–II (audyt architektury + warstwa wiedzy) mają **twardą kolejność zależności** — nie przeskakuj.
- Części III+ to checklisty niezależnych punktów — rób w dowolnej kolejności w ramach priorytetu.

---

# Część I — Audyt architektury 2026-07 (sekwencja z zależnościami)

> Zebrane z sesji audytowej 2026-07-07 (audyt architektury + 5 rund głębokich znalezisk + weryfikacja w kodzie). To jest jedyna zsekwencjonowana lista z tego audytu — pozycja niżej często wymaga tego co wyżej, to graf zależności, nie ranking ważności. Sekcje "Część II" niżej to pełny opis pozycji z Fazy 1.5–5 poniżej.

**Poprawki względem oryginalnej listy z czatu** (zweryfikowane w kodzie 2026-07-07 — jeśli widzisz te punkty gdzieś jeszcze jako otwarte, są nieaktualne):

| Punkt oryginalny | Status | Dowód |
|---|---|---|
| Partia 3 #23 „skonsolidować compute-* w vanguard-nightly" | **ZROBIONE** | `supabase/functions/vanguard-nightly/index.ts` istnieje, woła wszystkie `_shared/nightly/*` kroki |
| Partia 4 #32 „odkomentować vanguard_graph_cleanup, czeka od maja" | **ZROBIONE** | migracja `20260707160000_vanguard_graph_cleanup_restore.sql` — cron `vanguard-sunday-cleanup` zaplanowany |
| Partia 4 #35 „zbudować globalne wyszukiwanie" | **JUŻ ISTNIEJE** | `SearchModal.tsx` wpięty w Dashboard + `vanguard-search` na backendzie — zweryfikuj pokrycie zamiast budować od zera |

Zduplikowane punkty scalone: Partia 1 #9/#10 + Ciągłe #42/#43 → jedna reguła (`as any` zakaz + `*Api.ts` DAL + ESLint `no-explicit-any: error` + `max-lines`, egzekucja = zasada skauta przy dotyku, patrz Faza 1). Partia 2 #17/#18/#19 → jeden model synchronizacji Oura. Partia 0 #4 + Partia 2 #19 → ten sam bug (`gatherUserContext` w dwóch miejscach) — usuń oba na raz.

## Faza 0 — Bezpieczeństwo i domknięcie sesji (rób pierwsze, zawsze)

1. **Backup** — nocny `pg_dump` (GitHub Action cron) + kopia bucketów (`progress-photos`, `todo-attachments`) + test odtworzenia na czystym projekcie.
2. **Zielony typecheck na main** — `catch (e)` bez typu w `usePowerListData` (×3), `CalendarView:805`, typy `calendar-write`. Rób razem z Priorytetem 1 z Części III (`InsightsDashboard.tsx`, `GrowthView.tsx`, `PatternCard.tsx` — ten sam typ buga, jeden sweep).
3. **Git** — czysty working tree przed każdą fazą.
4. **`gatherUserContext`** — usuń z `OracleCard:351` i z `usePowerListData` na raz (ten sam wzorzec, 15 zapytań do kosza przy każdym otwarciu).
5. **Sekrety/URL placeholdery w migracjach — pełny sweep.** `grep -rn "YOUR_PROJECT_REF\|YOUR_.*_KEY\|YOUR_.*_SECRET" supabase/migrations` i napraw wszystkie trafienia w jednej sesji, nie jeden plik. Znane: cron `metabolism` (`YOUR_SERVICE_ROLE_KEY`), `trigger_daily_snapshots` (URL z `YOUR_PROJECT_REF`, `GRANT EXECUTE ... TO service_role`).
6. **Deploy + migracje zaległe** (`realtime_publication`, `metabolism_flag`, cron) + deploy `oracle`/`executor`/`metabolism`.
7. **Test dwóch magii** — task z Telegrama pojawia się sam w otwartej apce; odpowiedź Oracle płynie strumieniem.
8. **`VANGUARD_USER_ID` fail-fast** — wyjątek zamiast fallbacku na usera-ducha `0000...`.

## Faza 0.5 — Repo↔Prod integrity audit (przed jakąkolwiek dalszą konsolidacją)

> ⚠️ Zanim wykonasz krok 1 — potwierdź `project_id` Vanguarda. Sprawdzone 2026-07-07: `list_projects` przez Supabase MCP w sesji agenta domyślnie może zwrócić inny projekt (widziano `vjcfsruwhcthltpehsoz`, platforma quizowa, nie Vanguard). Nie zakładaj, że jedyny widoczny projekt to Vanguard tylko dlatego, że konto się zgadza — potwierdź `project_id` przed krokami 1-2.

**Dlaczego to jest tuż po Fazie 0:** zweryfikowano dwa niezależne dowody tego samego wzorca — repo i produkcja się rozjeżdżają bez śladu:
- `scripts/ops/e2e-daily-loop.mjs:132,171` testuje `compute-daily-strain`/`save-daily-aggregate` — funkcje bez źródła w repo (skonsolidowane do `vanguard-nightly`, heartbeat o tym nie wie).
- Migracja `20260704171601_cron_vanguard_detect_patterns.sql` planuje cron uderzający w funkcję, której nigdy nie było w repo jako osobny plik.
- `supabase/functions/vanguard-backtester/` — katalog istnieje, zero plików źródłowych.

Kroki:
1. Pełny audyt jednym przebiegiem: `list_edge_functions` (Supabase MCP) vs `ls supabase/functions/*` w repo → wypisz wszystkie rozbieżności naraz.
2. Dla każdej rozbieżności: jeśli funkcja działa na serwerze i ma wartość — ściągnij kod zamiast pisać od zera. Jeśli nie istnieje nigdzie — zaktualizuj/usuń to, co na nią wskazuje (`e2e-daily-loop.mjs`, `smoke-manifest.mjs`, migracja `cron_vanguard_detect_patterns`).
3. **Zbuduj deploy ledger** — tabela lub plik `deployed_functions(name, git_sha, deployed_at, deployed_by)` aktualizowana ręcznie przy każdym deployu (`docs/runbooks/deploy-edge-function.md` dostaje krok 0: zapisz do ledgera przed deployem). CI (`ci.yml`) nigdy nie deployuje funkcji ani nie robi `db push` — deploy jest w 100% ręczny i nigdzie nie zostawia śladu.
4. Heartbeat: przestań testować HTTP OPTIONS/200 na same funkcje — przepnij na czytanie `vanguard_pipeline_runs` (patrz Faza 2 §2.3 w Części II). Testowanie "czy funkcja odpowiada" nie sprawdza, czy praca została wykonana.

## Faza 1 — Strażnicy procesu (tydzień 1)

9. **Reguły agentów w `AGENTS.md`/`FRONTEND_GUIDE.md`** + ESLint jako prawo: `max-lines` 300/150, `no-explicit-any: error`, lista LEGACY-wyjątków która może tylko maleć. Egzekucja per plik przy dotyku (zasada skauta), nie jednorazowy sweep całego repo.
10. **Knip do CI** + wyczyścić martwe pliki/eksporty, które wskaże.
11. **Jawne `verify_jwt` per funkcja** w `config.toml` — dziś tylko część z 31 funkcji ma jawny wpis; sprawdź resztę.
12. **Logowanie kosztów LLM** — `usage` z każdej odpowiedzi do tabeli.
13. Heartbeat→Telegram przy failu — już przeprojektowane w Fazie 0.5 pkt 4, nie osobne zadanie.
14. **`_pending_faza1`** — migracje w limbo od maja: apply albo delete.

## Faza 1.5 — Knowledge Leverage, Priorytet 1

Wykonaj w tej kolejności (§1.3 wymaga §1.1 jako warunku) — pełny opis w Części II §1.1–§1.3:
1. **§1.1** Write-back `proposed_memory` z ClarificationRequest do grafu wiedzy — największa dźwignia/koszt całego audytu (~1 wieczór).
2. **§1.2** Kalibracja prognoz (Brier/MAE) — metryka nadrzędna.
3. **§1.3** Pompa active learning.

## Faza 2 — Domknięcie rozliczeń

Pełny opis w Części II §2.1–§2.3:
1. **§2.3** Nightly pipeline ledger — scalone z Fazą 0.5 pkt 4.
2. **§2.2** `vanguard-backtester` — krok 1 (audyt repo↔prod) już w Fazie 0.5; krok 2-3 dopiero PO §2.1 i bitemporalności z Fazy 4.
3. **§2.1** Rada Oracle'a jako obiekt.
4. **Backfill/replay dla danych pochodnych** — `runComputeDailyStrain` i `metrics_*` przyjmują tylko "dziś". Dodaj `dateFrom/dateTo`, nightly dostaje tryb `?backfill=X..Y`. Rób razem z `algo_version` (Faza 4) — jedna migracja, jeden PR.

## Faza 3 — Model pojemności + struktura frontendu

Kolejność krytyczna — dokończ react-query przed routerem i offline queue:
1. Część II §7.1 — dokończyć migrację z ręcznych `useEffect+useState` na react-query.
2. Router zamiast ręcznej nawigacji (stan w URL, deep-linki).
3. Trio Oura → jedna funkcja + desktop sync storm.
4. Offline write queue (react-query persist + mutation queue).
5. Skróty PWA (`/?todo=new`, share_target).
6. Miniatury client-side przy uploadzie.
7. Część II §3.1–§3.2 — model pojemności (effort na zadaniach + `useAIScheduling` podłączony do recovery/world_state).

## Faza 4 — Graf wiedzy i backtester (przy najbliższym dotknięciu architekta/wiki-compilera)

Część II §4.1–§4.9, w tej kolejności:
1. **§4.6** Tabela encji — sprawdź najpierw `vanguard_entity_aliases` (martwa, patrz Część III write-orphany) zanim zbudujesz nową.
2. **§4.5** Bitemporalność (`learned_at`) — rób razem z `algo_version` i backfill/replay z Fazy 2.
3. **§4.1** Warstwa `claims` jako nadrzędna nad graf/wiki/fundament.
4. **§4.2** Korelacje/patterns emitują claims.
5. **§4.3 + §4.4** `outcome_metric` per pattern + fix `user_id` w `outcomes.ts`.
6. **§4.7** Dossier celu.
7. **§4.8** Tygodniowy diff self-modelu.
8. **§4.9** 4 Lenses do promptu — 15 minut, tylko tekst.

## Faza 5 — Uczciwość danych, ludzie/świat zewnętrzny, ostatnie mile

Część II §5.1–§5.6 (braki danych, coverage metryk, korekty LLM, cykliczność, pogoda, confoundery) i §6.1–§6.2 (maraton jako obiekt, raport dla trenera Igora).

Reszta Partii 4/5 z oryginalnego audytu:
- `dream_id` auto-sugestia albo wycięcie.
- Cmentarz martwych tabel (schemat `graveyard`, po row-count) + regeneracja `database.types.ts`.
- Jeden przełyk capture (Telegram/share/skróty/voice = aliasy jednej rury).
- Telemetria `view_events`.
- keep-triage → LinksInbox auto-tagowanie.
- Cele żywieniowe → `MorningPlanModal`.
- Panel zdrowia systemu z `audit_events` — bundle z §5.2 (licznik pokrycia metryk).
- Sprzątanie repo (`.mimocode`, `screeny/`, `PRPs/`, `examples/`, skrypty jednorazowe).

**Budżet/kolejka powiadomień:** co najmniej 8 funkcji (`vanguard-analyst`, `vanguard-auto-classify`, `vanguard-nutrition-coach`, `vanguard-daily-reconciliation`, `vanguard-push-reminder`, `vanguard-weekly-synthesis`, `vanguard-librarian`, `vanguard-executor`, `vanguard-eval-interview`) woła Telegram API bezpośrednio, bez wspólnej bramki. Tabela `outbound_messages(priority, dedupe_key, send_after)` + jeden worker wysyłający — każda funkcja proponuje, nie wysyła bezpośrednio.

## Ciągłe / bez końca (zasada skauta — nie osobna sesja per punkt)

- **LLM gateway + rejestr promptów**, rozszerzony o: centralizację sekretów (`DEEPSEEK_API_KEY` czytany bezpośrednio w ~30 plikach zamiast przez `_shared/config.ts`) i tier wrażliwości danych (prompty medyczne/rodzinne idą dziś do tego samego vendora co wszystko inne).
- Reszta punktów ciągłych — wykonuj przy dotyku odpowiedniego modułu.

**Zasada zamykająca Części I:** po Fazie 1.5 (§1.2 — kalibracja prognoz) masz obiektywny sygnał, czego jeszcze brakuje: jeśli krzywa błędu predykcji się wypłaszcza, model głoduje konkretnej zmiennej — dopiero wtedy dokładaj nowy sensor. Nie odwrotnie. Nie dokładaj nowych punktów do Części I bez uzasadnienia zależności (co blokuje, co odblokowuje).

---

# Część II — Warstwa wiedzy i dźwigni (Knowledge Leverage)

> System już zbiera dane o Jakubie — pytanie tej części to czy faktycznie wie to, co zbiera, i czy się z tego rozlicza. Wspólny wzorzec każdej pozycji: **zero nowego codziennego inputu od Jakuba** — złączenie/domknięcie klocków, które już istnieją w kodzie. Jeśli realizacja wymaga codziennego ręcznego wpisywania czegoś — sygnał, że coś zaprojektowano źle.

Kanoniczny flow wiedzy:

```
Telegram / voice / manual ingest
        │
        ▼
  vanguard_stream          ← surowa ewidencja użytkownika (source of truth)
        │
        ├──► vanguard-auto-classify  → friction_events (jedyny pipeline tarcia)
        ├──► vanguard-architect (batch) → vanguard_entity_links (graf wiedzy — triady)
        ├──► vanguard-wiki-compiler → vanguard_wiki_pages (skompilowana pamięć, derived)
        └──► ingest-vault-log (long-form) → stream chunks + graf RPC

READ path: Oracle czyta graf + wiki + world_state + stream
Nightly: agreguje dzień, liczy strain/illness/recovery, wykrywa patterny, liczy korelacje
```

Kluczowe tabele: `vanguard_entity_links` (graf, triady z `confidence_score`, `status`, `superseded_by`), `vanguard_wiki_pages` (derived, `source_refs`), `vanguard_wiki_review_items` (kolejka do przeglądu), `oracle_clarification_requests` (pytania Oracle do Jakuba), `vanguard_daily_aggregates`, `vanguard_behavioral_patterns` + `pattern_events`, `vanguard_oracle_runs` (read-only telemetria), `behavior_log` (confoundery).

**Konstytucyjna zasada, którą każda pozycja musi respektować:** Oracle NIE zapisuje do grafu/wiedzy automatycznie w każdej turze rozmowy — celowo wyłączone w Sprint 0.7 (LLM mutował source-of-truth bez weryfikacji). Każda propozycja poniżej dotycząca zapisu do grafu MUSI przechodzić przez bramkę potwierdzenia człowieka (ClarificationRequest, §1.1) — nigdy bezpośredni zapis z odpowiedzi czatu.

## 🥇 Priorytet 1 — najwyższa dźwignia, najniższy koszt

### §1.1 Write-back `proposed_memory` z ClarificationRequest do grafu wiedzy

**Co to jest:** Oracle, zamiast zgadywać niepewny fakt, zadaje strukturalne pytanie Jakubowi. System prompt (`vanguard-oracle/oracle/systemPrompt.ts:84-109`) generuje `clarification_request` gdy confidence < 0.7. Zapis: `vanguard-oracle/oracle/mutations.ts:29-50` (`saveClarificationRequest`) — insert do `oracle_clarification_requests` (`question`, `response_type`, `options`, `dedupe_key`, `evidence_fact_ids`, `proposed_memory`, `confidence`, `status: 'pending'`). UI: `ClarificationRequestCard.tsx`, `OracleCard.tsx:104-236`, `ActionCenterSheet.tsx`.

**Problem:** `ClarificationRequestCard.tsx:65` po odpowiedzi robi tylko `.update({status:'answered', answer, answered_at})`. `proposed_memory` — fakt który Jakub właśnie POTWIERDZIŁ — nie ląduje nigdzie jako trwały fakt. Jedyny efekt: `rag.ts:599-603` wstrzykuje odpowiedzi z powrotem jako blok tekstu do promptu następnej rozmowy. Fakt potwierdzony przez człowieka jest przechowywany jako **kontekst czatu**, nie jako **twierdzenie w grafie** — po kilku tygodniach kontekst wypadnie z okna i fakt zniknie.

**Dlaczego najwyższa dźwignia:** to jest dokładnie bramka "human confirmation przed zapisem do grafu", której zabrakło przy amputacji Sprint 0.7. Nie trzeba jej projektować od zera — istnieje, tylko ostatni drut nie jest podłączony.

**Co zbudować:**
1. Po `status: 'answered'`, tylko gdy odpowiedź faktycznie potwierdza `proposed_memory`: insert do `vanguard_entity_links` z `source_entity`/`target_entity`/`relation` (albo: dodać do systemPrompt Oracle wymóg gotowej triady `proposed_triad: {source, relation, target}` obok tekstu — łatwiejsze niż parsować), `confidence_score: 0.95`, `status: 'active'`, provenance (`source: 'user_confirmed_clarification'`), `learned_at: now()` (patrz §4.5, jeśli kolumna nie istnieje — dodać przy tej migracji).
2. Kolizja z istniejącym aktywnym faktem (ten sam `source_entity`+`relation`) → oznacz stary jako `superseded` przez istniejący `_shared/deprecateSupersededLinks.ts`.
3. Test: odpowiedz na jedno pytanie Oracle w UI, sprawdź nowy wiersz w `vanguard_entity_links`.

**Koszt:** ~1 wieczór.

### §1.2 Kalibracja prognoz — metryka nadrzędna dla całej reszty audytu

**Kontekst:** scope-gates na predykcje uchylone 2026-07-02. Od tego czasu nic nie zbudowano — brak jakiejkolwiek `predicted_*` w `database.types.ts`.

**Problem:** system twierdzi (Oracle, wiki, patterns), że "rozumie" Jakuba, ale nic tego nie weryfikuje.

**Co zbudować:**
1. Tabela `vanguard_daily_predictions`: `user_id`, `date`, `predicted_at` (musi być PRZED dniem którego dotyczy), `metric` (`sleep_hours`/`readiness_score`/`execution_score`), `predicted_value`, `predicted_interval_low/high`, `actual_value`, `error`.
2. Krok w `vanguard-nightly`: na podstawie ostatnich N dni + world_state generuj predykcję na jutro (prosty model wystarczy — średnia ważona 7 dni + trend, LLM niekonieczny).
3. Następnego dnia: uzupełnij `actual_value` z `vanguard_daily_aggregates`/`oura_daily_summary`, policz błąd.
4. Po miesiącu: dashboard z Brier score/MAE. Malejący błąd = self-model się uczy. Płaski/rosnący = sygnał czego brakuje.

**Dlaczego priorytet, nie ciekawostka:** jedyny obiektywny sposób, żeby zdecydować, CZY dokładać nowe źródła danych (pogoda, cykliczność — §5.4/§5.5) — dokładaj sensor dopiero gdy krzywa kalibracji się wypłaszcza.

### §1.3 Pompa active learning: `vanguard_wiki_review_items` → `oracle_clarification_requests`

**Kontekst:** `vanguard-wiki-compiler` już generuje `ReviewDraft` (`item_type`, `title`, `detail`, `severity`, `source_refs`) do `vanguard_wiki_review_items`.

**Problem:** kolejka istnieje i jest zapełniana, ale nic jej nie konsumuje. `vanguard-eval-interview` (cron `0 10 * * 1-5`) zadaje generyczne pytanie, nie oparte na tym czego system jest niepewny.

**Co zbudować:**
1. W `vanguard-eval-interview` albo nowym kroku nightly: zamiast/obok generycznego pytania — weź top 1-2 nieprzejrzane z `vanguard_wiki_review_items` (po `severity`) albo `vanguard_entity_links` z `status='active'`, `confidence_score < 0.7`, najstarszy `created_at`.
2. Wygeneruj `oracle_clarification_request` (reużyj `saveClarificationRequest`), `dedupe_key` zapobiega duplikatom.
3. Odpowiedź przechodzi ścieżką z §1.1 — **§1.1 musi być zrobione przed tym punktem**.
4. Rezultat: pełny obieg — wiki-compiler wykrywa niepewność → eval-interview pyta → Jakub potwierdza → wiedza rośnie z provenance.

## 🥈 Priorytet 2 — domyka pętle rozliczenia

### §2.1 Rada Oracle'a jako obiekt, nie gaz

**Problem:** `systemPrompt.ts:93` definiuje `"fact | hypothesis | recommendation"`, ale żadna rekomendacja nie jest obiektem z warunkiem/metryką sukcesu/oknem ewaluacji. `vanguard_oracle_runs` to tylko telemetria read-only.

**Co zbudować:**
1. Tabela `oracle_recommendations`: `id`, `oracle_run_id` (FK), `recommendation_text`, `related_metric` (z `_shared/correlationCatalog.ts`), `success_threshold`, `evaluation_window_days`, `status`, `outcome`.
2. Gdy Oracle emituje `type: "recommendation"` — zapisz (rozszerz `logOracleRun`).
3. Auto-ewaluacja: skopiuj wzorzec z `_shared/nightly/outcomes.ts` (`runPatternOutcomes`) — windowed join, źródło `oracle_recommendations` zamiast `pattern_events`.
4. Krok w `vanguard-nightly/index.ts`, analogicznie do kroku 5 istniejącego.

### §2.2 `vanguard-backtester` — katalog jest pusty

**Sprawdzone:** zero plików źródłowych w `supabase/functions/vanguard-backtester`. To ta sama klasa problemu co §0.5 wyżej.

**Co zrobić — w tej kolejności:**
1. Sprawdź przez Supabase MCP czy funkcja jest wdrożona na serwerze mimo braku źródła. Zrób pełny audit `list_edge_functions` vs repo — jedna sesja, wszystkie rozbieżności naraz.
2. Jeśli istnieje na serwerze — pobierz kod zamiast pisać od zera.
3. Jeśli nie istnieje nigdzie — napisz od zera, ale DOPIERO PO §2.1 i §4.5 (bitemporalność) — inaczej backtester nie ma czego oceniać uczciwie (przeciek przyszłej wiedzy do przeszłości).

### §2.3 Nightly nie ma księgi przebiegów (ledger)

**Sprawdzone:** `vanguard-nightly/index.ts:79-89` — każdy krok owinięty w `.catch(e => console.error(e))`, pipeline leci dalej. Jeśli krok 3 padnie, kroki 4-9 liczą na nieaktualnych danych, a `world_state` na końcu wygląda świeżo.

**Co zbudować:**
1. Tabela `vanguard_pipeline_runs`: `run_id`, `step_name`, `status`, `started_at`, `finished_at`, `error_message`.
2. W `vanguard-nightly/index.ts` — opakuj każdy krok helperem zapisującym wpis przed/po.
3. Heartbeat czyta ten ledger, nie testuje HTTP bezpośrednio (dziś fałszywy zielony status nawet gdy logika pada — `e2e-daily-loop.mjs:132` testuje `compute-daily-strain` przez OPTIONS, co nie sprawdza czy funkcja faktycznie coś policzyła).

## 🥉 Priorytet 3 — model pojemności (dotyczy codziennego planowania)

### §3.1 Zadania nie mają kosztu

**Sprawdzone:** `todo_items` nie ma kolumny effort/energy/duration (`duration_minutes` istnieje tylko dla `workout_sessions`).

**Problem:** `dailyPlanProposal.ts` widzi `readinessScore`/`recoveryScore` w `DirectionContextData`, ale nie ma czym tego wykorzystać — zadania nie deklarują ile kosztują.

**Co zbudować:**
1. Migracja: `estimated_effort` (1-5 albo enum `light`/`medium`/`heavy`) do `todo_items`.
2. `vanguard-todo-extract`/`vanguard-todo-classify` — dodaj pole do istniejącego promptu klasyfikującego (nie osobne wywołanie LLM).
3. `dailyPlanProposal.ts` — sumuj effort proponowanych zadań, porównaj z pojemnością dnia z `readinessScore`/`recoveryScore`, przytnij propozycję jeśli przekracza.
4. Kalibracja: `planAdherence.ts` — historia "planowano vs wykonano" koryguje mnożnik pojemności per poziom recovery.

### §3.2 `useAIScheduling` to hardkodowany bin-packer

**Sprawdzone:** `useAIScheduling.ts` — "Focus Time Defense" to zahardkodowany blok 8:00-10:00, niezależny od danych o Jakubie.

**Co zbudować:** po §3.1, podłącz ten sam model pojemności — sortuj/dobieraj zadania wg effort vs pora dnia vs recovery. Jeden prymityw naprawia trzy rzeczy naraz: planner (§3.1), scheduling (ten punkt), i "nightly pisze bloki kalendarza" (recovery, deep work pod checkpoint).

## Graf wiedzy — pozycje strukturalne

### §4.1 Warstwa `claims` jako nadrzędna nad graf/wiki/fundament

**Problem:** pięć niezależnych magazynów wiedzy o Jakubie: `vanguard_entity_links` (triady), `vanguard_wiki_pages` (kompilat), `user_fundament` (statyczna tożsamość, `rag.ts:101-104`), `vanguard_preferences` (`rag.ts:105-108`), i beliefs z `vanguard-metabolism` (hack: `index.ts:65-77` wrzuca skondensowany paragraf jako triadę `source_entity: "Kondensacja: {data}"` — string wciśnięty w niepasujący kształt tabeli). Oracle sklejam wszystkie pięć konkatenacją tekstu (`rag.ts`) bez referencji ani wspólnego confidence.

**Co zbudować (rób przy okazji dotykania architekta/wiki-compilera, nie osobną sesją):** kanoniczny obiekt `claim` (treść, typ `fact`/`hypothesis`/`belief`/`preference`/`correlation`, confidence, `evidence_refs`, ważność w czasie, `learned_at`). Graf → indeks dowodów, wiki → projekcja do czytania, `user_fundament` → twierdzenia zadeklarowane explicite (najwyższe zaufanie). Kierunek migracji, nie big-bang rewrite.

### §4.2 Korelacje/patterns nie emitują wiedzy do grafu

**Sprawdzone:** `correlationCatalog.ts` ma ~80 metryk numerycznych, `vanguard-architect` ekstrahuje triady z tekstu — te dwa światy nigdy się nie widzą. Odkryta korelacja nigdy nie staje się twierdzeniem, które Oracle może zacytować.

**Co zbudować:** krok w `vanguard-nightly` po `runComputeCorrelations` — istotne statystycznie korelacje (filtr `isInterestingCorrelation` z `correlationInterest.ts:41+`) emitują wpis do `claims`/`vanguard_entity_links` z `memory_type: 'correlation'`, `relation: 'koreluje_z'`.

### §4.3 `pattern_events` oceniane jedną uniwersalną metryką

**Sprawdzone:** `_shared/nightly/outcomes.ts` `runPatternOutcomes` ocenia SUKCES każdego patternu wyłącznie przez `execution_score >= 0.80`, niezależnie od domeny (sen, trening, jedzenie).

**Co zbudować:** kolumna `outcome_metric` na `vanguard_behavioral_patterns` (wartość z `correlationCatalog.ts`, ustawiana przy tworzeniu przez `vanguard-analyst`/`detect-patterns`). W `outcomes.ts` zamień hardkodowane `execution_score` na dynamiczny lookup.

### §4.4 Bug: brak filtra `user_id` w `outcomes.ts`

`outcomes.ts:29-33` — zapytanie do `vanguard_daily_aggregates` bez `.eq('user_id', userId)`. Dziś niegroźne (single-user), mina pod przyszłość. Napraw przy okazji §4.3 (i tak edytujesz ten plik).

### §4.5 Brak bitemporalności — backtester będzie oszukiwał

**Sprawdzone:** `vanguard_entity_links` ma `superseded_by`/`status`, ale nie rozróżnia "kiedy to było prawdą" (`valid_at`) vs "kiedy system się dowiedział" (`learned_at`). Backtester oceniający radę z 15 maja może przypadkowo skorzystać z wiedzy zdobytej w czerwcu — przyszłość przecieka do przeszłości.

To ten sam problem klasowo co `algo_version` (kolumna na danych pochodnych typu strain/aggregates, żeby backtest nie mieszał wzorów).

**Co zbudować:** kolumna `learned_at` (domyślnie `created_at`) na `vanguard_entity_links` i na `claims` (§4.1, gdy powstanie). W retrievalu backtestera filtruj `learned_at <= as_of_date`. **Zrób PRZED napisaniem backtestera od zera** (§2.2), razem z `algo_version`.

### §4.6 Graf jest stringowy, nie encyjny

**Sprawdzone:** `vanguard-architect/extraction/processor.ts:44` — dedup encji to instrukcja w prompcie LLM, nie tabela. `vanguard_entity_links` trzyma `source_entity`/`target_entity` jako gołe stringi.

**Co zbudować:** tabela `vanguard_entities`: `id`, `canonical_name`, `aliases` (text[]), `entity_type`, `embedding`. `vanguard-architect` przy tworzeniu triady najpierw rozwiązuje source/target do istniejącej encji (fuzzy match + embedding) zamiast tworzyć nowy string za każdym razem. Fundament pod: backlink view (klik na encję → wszystkie wpisy jej dotyczące), dossier encji, statystyki centralności węzłów.

**Uwaga:** `vanguard_entity_aliases` już istnieje w bazie, ale jest martwa (porzucony resolwer, patrz Część III write-orphany). Sprawdź ją PRZED tworzeniem nowej tabeli.

### §4.7 Dossier celu

**Problem:** retrieval Oracle jest query-driven (`classifyIntentSafe`, `buildGraphSeeds` w `rag.ts`). System zna cele Jakuba, ale nic nie kompiluje wiedzy WOKÓŁ konkretnego celu przekrojowo.

**Co zbudować:** `vanguard-wiki-compiler` — nowy `page_type: 'goal'`. Dla każdego aktywnego `life_goal` kompiluj: relevantne korelacje, twierdzenia z grafu dotyczące celu (przez encje z §4.6), eksperymenty, checkpointy, trend metryki vs gap do celu. Złączenie istniejących danych, nie nowe źródło.

### §4.8 Tygodniowy diff self-modelu

**Problem:** system zmienia przekonania niewidzialnie — brak zapisu "co system zmienił w tym, co wie o Jakubie".

**Co zbudować:** krok w `vanguard-weekly-synthesis` — wiersze `vanguard_entity_links` z `created_at`/`superseded_at` w ostatnim tygodniu → krótkie podsumowanie ("3 nowe twierdzenia, 1 nadpisane: X→Y"). Prefill do `WeeklyReviewModal`.

### §4.9 4 Lenses — 15 minut roboty

Cztery kąty analizy z Memex, wciąż niewdrożone: Hidden Contexts, Energy Tides, Micro-Consistency, Interactive Curiosity. Dodaj jako instrukcję do system promptu `vanguard-analyst` i/lub `vanguard-oracle/oracle/systemPrompt.ts`. Zero nowego kodu poza tekstem promptu.

## Uczciwość danych — braki i skażenia próby

### §5.1 Braki danych nie są rozróżnialne od zdarzeń

Dzień bez zalogowanego posiłku wygląda identycznie jak dzień głodówki. Brak wpisu w `behavior_log` wygląda jak "na pewno nie wystąpiło", nie "nie wiadomo".

**Co zbudować:** UI — jedno tapnięcie przy powrocie po przerwie w logowaniu (>2 dni bez wpisu w `vanguard_stream`, potem pierwszy wpis) z pytaniem "przerwa: OK / chory / podróż" → `behavior_log`. Silnik korelacji wyklucza oznaczone okna zamiast błędnie interpretować jako normalne.

### §5.2 Licznik pokrycia metryk — cicha śmierć rur danych

Katalog ma ~80 metryk, nic nie mierzy jaki % dni każda faktycznie ma wartość. Rura, która się zepsuje, głoduje po cichu — insighty znikają bez alarmu.

**Co zbudować:** krok w `vanguard-nightly` liczący % dni z niepustą wartością (30 dni) per metryka → `metric_coverage_stats` albo `audit_events`. Wyświetl w panelu zdrowia systemu.

### §5.3 Korekty LLM giną bezpotomnie

Gdy Jakub poprawia output LLM, poprawka nadpisuje wiersz — nic nie rejestruje że to była korekta BŁĘDU (vs zwykła edycja).

**Co zbudować:** kolumna `corrected_from` (JSON) na tabelach z edytowalnym LLM outputem. Przy budowie rejestru promptów — ostatnie N korekt jako few-shot examples.

### §5.4 Zero obsługi cykliczności w silniku korelacji

**Sprawdzone:** `correlationEngine.ts`/`correlationSeries.ts` — zero wzmianki o dniu tygodnia/sezonie. Sesja egzaminacyjna (semestr PRz) zawsze traktowana jako świeża anomalia.

**Co zbudować:** cechy cykliczne (`day_of_week`, `days_to_exam`) jako metryki pierwszej klasy w `correlationCatalog.ts`. Opcja stratyfikacji w silniku korelacji.

### §5.5 Pogoda i fotoperiod nie karmią korelacji

Pogoda widoczna w kalendarzu (commit `f259bb7c`), ale nie w `correlationCatalog.ts` — nie wchodzi do analizy.

**Co zbudować:** integracja Open-Meteo (nightly) — temperatura, ciśnienie, godziny światła, zachód słońca → `daily_weather` (albo rozszerz `vanguard_daily_aggregates`) → do katalogu korelacji. Priorytet: pora zasypiania (~01:00) to problem zdrowotny #1, fotoperiod jest jednym z najsilniej udokumentowanych driverów rytmu dobowego.

### §5.6 Analityka bez modelu confounderów

`behavior_log` ma kolumny na klasyczne confoundery (alkohol, choroba, podróż, stres), silnik korelacji liczy surowe pary bez stratyfikacji.

**Co zbudować:** minimalna wersja — flaga w `evidence_text` ("N z M dni zawierało alkohol/chorobę"). Pełna wersja — stratyfikacja: licz korelację osobno dla dni z/bez confoundera.

## Ludzie i świat zewnętrzny

### §6.1 Maraton nie istnieje jako obiekt w systemie

Kontekst: VO2max 47.1, cel sub-4h Koszyce 2026-10-04, trener Igor, gap +2.9 do celu, PR 1K 4:25.

**Problem:** system mierzy trening, ale nigdzie nie reprezentuje planu do konkretnego celu z datą. Brak trendu VDOT/tempa względem celu, brak countdownu, brak "planned-vs-executed" na poziomie tygodnia.

**Co zbudować:** dossier wyścigu (instancja §4.7). Krok w nightly: prognoza czasu maratonu z ostatnich biegów (formuła Riegela), planned-vs-executed treningu, countdown do 2026-10-04.

### §6.2 Vanguard jest single-player, cel #1 ma drugiego gracza

Zero interfejsu dla trenera. Igor programuje trening na ślepo/ustnie, podczas gdy Vanguard codziennie liczy strain/recovery/illness/RPE.

**Co zbudować:** cotygodniowy raport dla trenera (link/PDF/Telegram-forward): trend objętości, recovery, flagi choroby/przemęczenia, RPE rzeczywiste vs zaplanowane. Zero nowego inputu od Jakuba.

## Frontend / infrastruktura (patrz też Część IV)

### §7.1 Pół-migracja na react-query

**Sprawdzone:** `QueryClientProvider` wpięty, ale obok istnieje ~29 ręcznych hooków fetch+useState w `src/hooks/`. Pół-migracja gorsza niż każdy z końców — dwa równoległe modele cache.

Offline write queue i realtime invalidation potrzebują JEDNEGO modelu danych. Dokończenie migracji to warunek wstępny dla routera/sync/offline (Faza 3), nie kosmetyka.

## Kolejność wykonania Części II (rekomendacja)

1. Faza 0 (Część I) zawsze pierwsza.
2. **§1.1** (największa dźwignia — 1 wieczór, odblokowuje ścieżkę zamkniętą od Sprint 0.7).
3. **§1.2** (metryka nadrzędna).
4. **§1.3** (wymaga §1.1).
5. **§2.3** (wszystko inne stoi na tym, że nightly faktycznie się wykonuje).
6. **§2.2 krok 1** (audit repo vs deployed).
7. Reszta Priorytetu 2/3 + "Graf wiedzy" — przy najbliższym dotknięciu odpowiednich funkcji.
8. "Uczciwość danych" + "Ludzie i świat zewnętrzny" — kandydaci na okresy niższego tempa developmentu.

**Zasada zamykająca:** po §1.2 masz obiektywny sygnał czego brakuje — jeśli krzywa błędu predykcji się wypłaszcza, dokładaj nowy sensor. Nie odwrotnie.

---

# Część III — Bugi i dług techniczny

> Zebrane z audytu 2026-07-05 (god-files, write-orphan tables, silent-fail writes, helper bypass, offline resilience, AI client dedup). Checklist, nie plan.

## 🔴 Priorytet 1 — silent-fail na aktywnie używanych funkcjach

- [x] `InsightsDashboard.tsx:63-82` — `fetchCards`/`handlePin`/`handleSort`/`handleDelete` mają `try/catch` + weryfikację `error`; delete pesymistyczny.
- [x] `GrowthView.tsx:230-234` `handleDonePin` — `linkErr`/`todoErr` sprawdzane, rzucane do zewnętrznego `catch`.
- [x] `PatternCard.tsx:38-47` — `update()` zwraca `error`, rzucany gdy non-null; alert dla użytkownika.

## 🟠 Priorytet 2 — write-orphany (dobuduj zapis albo usuń martwy odczyt)

- [ ] `endmyopia_daily_logs` — czyta `VisionJournal.tsx`, zero writera.
- [ ] `user_fundament` — `IdentityVault.handleSave()` woła `ingest-vault-log`, niepotwierdzone czy zapisuje tabelę.
- [ ] `nutrition_profile` — 8 miejsc czyta, zero insert/update/upsert.
- [ ] `location_history` — czyta `exportStats.ts`, zero writera.
- [ ] `medical_documents`, `medical_lab_results` — tylko jednorazowy seed, brak ścieżki dodania nowych wyników.
- [ ] `training_plan_workouts` — brak ścieżki edycji planu.
- [ ] `user_portions` — RLS gotowe pod zapis LLM, zero insert/update wywołania.
- [ ] `morning_briefs` — całkowicie martwa.
- [ ] `vanguard_entity_aliases` — martwa, porzucony resolwer encji (patrz Część II §4.6 — sprawdź przed budową nowej tabeli encji).

## 🟡 Priorytet 3 — ominięte kanoniczne helpery

- [ ] `todo_items` — surowe zapisy poza `lib/todo.ts`: `checkpoints.ts:85`, `projects.ts:119-183` (3 miejsca), `GrowthView.tsx:233`, `MorningPlanModal.tsx:396-397`, + 3 edge functions (`vanguard-telegram`, `vanguard-push-reminder`, `vanguard-todo-classify`).
- [ ] `kpi_entries` — `Projects.tsx:386-391` omija RPC `increment_kpi_entry_for_week`; `KpiTrendSparkline.tsx:76-90` fallback liczy `+1` z lokalnego stanu (stale-read tylko gdy RPC padnie).

## 🟢 Priorytet 4 — duplikaty logiki daty/timezone

- [ ] `useGrowthData.ts:281` — `todayStr = weekStart` (mylące), psuje liczenie "dni po terminie" przy oglądaniu innego tygodnia.
- [x] `AddPrescriptionModal.tsx:19` — surowy `new Date().toISOString().split('T')[0]`.
- [ ] `fitnessScore.ts:307` — niska pewność, wymaga doczytania.
- [ ] `LeniePanelMini.tsx:20` — poprawna logika, tylko zduplikowana (code smell, nieszkodliwe).

## 🔵 Priorytet 5 — struktura kodu (god-files)

Zastąpione przez klasyfikację Tier 1/2/3 w Części IV §P6 (nowsza, dokładniejsza — bazuj na niej, nie na tej liście).

## ⚪ Priorytet 6 — inne, mniej pilne

- [ ] Test coverage edge functions: 4 pliki testowe na ~30 funkcji.
- [ ] CI łapie dryf migracji DB, ale nie dryf **wdrożonego kodu funkcji** vs repo (ten sam incydent co `vanguard-detect-patterns`/backtester, Część I Faza 0.5).
- [ ] `as any` w `src/` — patrz Część IV §PD1/§PD2 dla aktualnego stanu i planu.
- [ ] Offline queue pokrywa na razie tylko trening + posiłek — notatki/todo/nawyki wciąż rzucą błąd offline.
- [ ] Architektura `task_1..task_5`/`done_1..done_5` w `daily_wins` — sztywne sloty (nie ruszać bez wyraźnej potrzeby, tylko świadomość).
- [ ] Nie zrobiono: pełny audyt RLS na 100 tabelach, wydajność zapytań/indeksów, bundle size frontendu.

---

# Część IV — Frontend: dług strukturalny (post „10/10”)

> Trzy plany „10/10” (`FRONTEND_10_10_PLAN.md`, `DESIGN_SYSTEM_10_10.md`, ten plik) skasowane po wykonaniu/wchłonięciu 2026-07-11. Trwałe reguły z nich → `docs/FRONTEND_GUIDE.md` i `docs/DESIGN_SYSTEM.md`. Otwarta praca — tutaj.
>
> **Stan bazowy (11.07.2026):** `FRONTEND_10_10_PLAN.md` S0-S14 zamknięte (commit `903a4a8d`). `DESIGN_SYSTEM_10_10.md` DS0/DS2/DS3/DS5 zamknięte; **DS1 i DS4 częściowe** (patrz §DS niżej). Spłata długu P1-P4 zamknięta (`fixed inset-0` 18→11, `session` prop 44→28, `as any` 119→59, `maxWarnings` 659→496). P5 (rozbicie 5 największych god-files) — **1/5 zrobione** (`MorningPlanModal.tsx`). P6 (~111 mniejszych god-files) — **nie zaczęte**.

## P0 — Backend krytyczne (blokery, rób pierwsze)

Zweryfikowane w kodzie 2026-07-11, wszystkie wciąż otwarte.

### P0.1 — Nightly gubi wzorce co noc (~30 min)

`_shared/nightly/patterns.ts:47` zwraca `status: "hypothesis"` — CHECK constraint na `vanguard_behavioral_patterns.status` dopuszcza tylko `pending/visible/user_confirmed/user_rejected/snoozed/archived`, insert cicho pada (`upsertPattern()` robi `console.error` i mimo to zwraca sukces).

- [ ] Zmień `"hypothesis"` → `"pending"` w `patterns.ts:47`, sprawdź resztę modułu (`grep hypothesis`).
- [ ] Deploy + weryfikacja: `SELECT count(*) FROM vanguard_behavioral_patterns WHERE status = 'pending'` przed/po następnym cronie — licznik musi rosnąć.

### P0.2 — Brak walidacji tokenu na `verify_jwt=false` endpointach (~1h)

`vanguard-nightly` i `vanguard-telegram-worker` mają `verify_jwt=false` i zero weryfikacji `Authorization`. Wzorzec poprawnej walidacji już istnieje w `vanguard-backtester`.

- [ ] Skopiuj wzorzec do obu funkcji.
- [ ] Sprawdź `cron.job.command` — jeśli service-role secret leży plaintextem, przenieś do Supabase Vault.
- [ ] `get_advisors` po zmianie — potwierdź że SECURITY DEFINER RPC (`get_desktop_dashboard_data` i inne wykonywalne przez `anon`) też objęte.

### P0.3 — Cotygodniowy `vanguard_graph_cleanup()` niszczy claims (~1-2h)

Trigger `tr_sync_entity_links_to_claims` przy DELETE z merge encji kasuje claims — sprzeczne z warstwą bi-temporalną (Część II §4.5). `merged_into` (nowszy mechanizm) ma 0 użyć.

- [ ] Przeczytaj `vanguard_graph_cleanup()` i `tr_sync_entity_links_to_claims`.
- [ ] Zdecyduj: wyłącz stary trigram-merge na rzecz `merged_into`, albo soft-delete/re-parenting zamiast kaskadowego kasowania.
- [ ] Backfill `entity_aliases` jeśli `merged_into` ma to zastąpić.

### P0.4 — Weryfikacja Fazy 4 (predykcje/rekomendacje) (~15 min)

- [ ] `SELECT count(*) FROM vanguard_predictions, oracle_recommendations, vanguard_pipeline_runs` — jeśli 0, debug przed zamknięciem tematu.

## PD — Polish Debt: spłata liczników strukturalnych

Zasada: jedna sesja = jedna kategoria = jeden commit, pełny zielony zestaw (`npm run typecheck:ui && npx eslint <dotknięte> && npm run test && npm run ratchet:frontend`) przed commitem, baseline w `scripts/ops/ratchet-baseline.json`/`legacy-lines-baseline.json` obniżony **w tym samym commicie**.

### PD1 — `as any`: top offenderzy (~2h)

Stan 2026-07-11 po P1-P4 (`as any` 119→59 ogółem; top-5 z tabeli poniżej liczone przed tym zejściem, zweryfikuj aktualne liczby przed sesją):

| Plik | Ile `as any` (stan wyjściowy audytu) |
|---|---|
| `src/lib/stats/exportStats.ts` | 60 |
| `src/components/lifestyle/direction/hooks/useDirection.ts` | 10 |
| `src/lib/offlineQueue.ts` | 4 |
| `src/lib/health/foodLogging.ts` | 3 |
| `src/lib/aiContext.ts` | 3 |
| `src/components/projects/LifeGoalsCard.tsx` | 3 |
| `src/components/lifestyle/usePowerListData.ts` | 3 |

- [ ] `exportStats.ts` — sprawdź czy to jeden powtarzalny wzorzec (np. `row as any` w mapowaniu eksportu), jeden typed helper zamiast castów osobno.
- [ ] Reszta: doprecyzuj typ lub `unknown` + type-guard (zasada #5 konstytucji — zero `as any`, nie "mniej").
- [ ] Jeśli powodem jest `database.types.ts` nieaktualny wobec schematu — `npm run db:update-types` najpierw.
- [ ] `useDirection.ts` (`week_*` pola) — spróbuj regenerację typów przed ręcznym typowaniem, casty mogą zniknąć za darmo.

Wzorce sprawdzone bezpieczne: `catch (e: any)` → `catch (e: unknown)` + `e instanceof Error`; `(x as any).pole` po narrowing zwykle zbędny; `Promise<any>` → `Promise<unknown>`; gdy prawdziwy typ istnieje gdzieś (API/DB row) — importuj go.

### PD2 — `as any`: reszta

- [ ] Pozostałe pliki z 1-2 wystąpieniami (`grep -rln "as any" src` po PD1 daje aktualną listę).
- [ ] Priorytet: pliki dotykane i tak w innych sesjach — rób `as any` przy okazji tego samego dotknięcia.

**Target:** 0. `patternCount_asAny` w baseline = 0.

### PD3 — `fixed inset-0`: reszta po DS1

**Nie rób równolegle z §DS1 niżej** — poczekaj aż DS1 wyląduje.

- [ ] `grep -rl "fixed inset-0" src/components | grep -v "ui/Modal.tsx\|ui/ConfirmDialog.tsx"` — powinno być 0-1.

### PD4 — God-files: fala 1 (Wzorzec A split, ~1 dzień, wysokie ryzyko — jeden plik/sesja)

Nakłada się z §P5 niżej (te same pliki) — **traktuj PD4 i P5 jako jedną listę pracy**, nie duplikuj. Metoda: `docs/FRONTEND_GUIDE.md` §9 "Folder jako moduł" (Wzorzec A). Zawsze: przeczytaj cały plik przed splitem, `Container`/`View`/`hooks`/`subcomponents`, weryfikacja wizualna w przeglądarce przed/po każdym pliku, obniż `legacy-lines-baseline.json` w tym samym commicie.

### PD5 — God-files: fala 2 (po PD4/P5)

Kolejna piątka: `exportStats.ts` (mniejsza po PD1), `usePowerListData.ts` (745), `ProjectCard.tsx` (613), `GrowthView.tsx` (605), `useDirectionContext.ts` (605 — najdłuższy hook, sprawdź czy da się wydzielić bez łamania `useGoalSpineInvalidation`, patrz `lessons.md` 2026-06-29 nieskończona pętla przy złych deps).

### PD6 — `maxWarnings`: zejście (powtarzalne co sesję)

- [ ] `npx eslint . -f json` → zsumuj warnings per `ruleId`, napraw jedną regułę naraz (mechaniczne, bezpieczne hurtem).
- [ ] Po każdej naprawionej regule: obniż `--max-warnings=N` w `package.json` **i** `maxWarnings` w baseline.
- [ ] Nie więcej niż 1-2 reguły na sesję.

**Target:** 496 (stan po P1-P4) → w dół, minimum -100/sesję.

## P5 — Rozbicie 5 największych god-files (4/5 zrobione)

| # | Plik | Stan | Ryzyko |
|---|---|---|---|
| 1 | `MorningPlanModal.tsx` (829→219 linii) | ✅ zrobione (`4035c423`) — 1 realna regresja znaleziona i naprawiona (`notify()` zgubiony w catch-u, niezłapany przez typecheck/lint/107 testów) | — |
| 2 | `CalendarGrid.tsx` (834→170 linii) | ✅ zrobione — extracted grid views, blocks, and drag-select hooks | — |
| 3 | `LinksInbox.tsx` (889→281 linii) | ✅ zrobione — extracted hook (`useLinksInboxData`) and subcomponent (`LinksInboxItem`) | — |
| 4 | `TodoCard.tsx` (869→442 linii) | ✅ zrobione — extracted `TodoCardExpandedPanel`, attachments hook, and swipe hook | — |
| 5 | `RichEditor.tsx` (855) | **świadomie NIE dzielić** | gęsto powiązana logika `window.getSelection()`/`Range`/`execCommand` na jednym `editorRef`; jedyne bezpieczne wydzielenie: `SLASH_COMMANDS` → osobny plik, nic więcej |

**Podział dla #2 (CalendarGrid):** `grid/CalendarGridBlocks.tsx` (renderery współdzielone dzień/tydzień jako nazwane funkcje z jawnymi argumentami), `grid/useCalendarDragSelect.ts`, `grid/CalendarDayView.tsx`, `grid/CalendarWeekView.tsx`, `grid/CalendarAgendaView.tsx` (jedyny naprawdę niezależny widok). Test manualny drag-to-create + drop + przełączanie widoków dla WSZYSTKICH 3 widoków.

**Podział dla #3 (LinksInbox):** `lifestyle/links/useLinksInboxData.ts` (wszystkie stany + handlery + `apiFetch*`/`apiSave*` z `lib/linksApi.ts`), `LinksInbox.tsx` zostaje jako View (`getYouTubeId`/`haptics`/`goTo` lokalnie).

**Podział dla #4 (TodoCard):** wymaga czytania całego pliku i planu tekstowego przed edycją. Kandydaci: `useTodoCardSwipe.ts` (gesty), `useTodoCardAttachments.ts` (upload/delete załączników).

## P6 — Reszta `LEGACY_FILES` (~111 plików, nie zaczęte)

**Odkrycie do zrobienia najpierw (~15 min, zero ryzyka):** sprawdź ile wpisów na liście `LEGACY_FILES`/`legacy-lines-baseline.json` jest już dziś pod limitem 300 linii (stare wpisy sprzed wcześniejszych refaktorów) — usuń je z obu list bez dotykania kodu.

**Klasyfikacja mechaniczna** (rób samodzielnie, nie proś o plan za każdym razem):

```bash
grep -c "return (" plik.tsx                                    # 0 = czysta logika, nie widok
grep -c "useState\|useReducer" plik.tsx                        # liczba stanów
grep -cE "onTouch|onDrag|execCommand|getSelection|onPointerDown" plik.tsx  # gesty/DOM = czerwona flaga
```

| Tier | Kryterium | Batch | Wymaga planu-do-akceptacji |
|---|---|---|---|
| 1 (mechaniczny) | 300-400 linii, ≤4 `useState`, 0 trafień gesty/DOM | do 3 plików/commit | nie |
| 2 (umiarkowany) | 400-600 LUB (300-400 z >4 `useState`) | 1 plik/commit | nie, ale pełna weryfikacja |
| 3 (ostrożny) | 600+ LUB jakiekolwiek trafienie gesty/DOM | 1 plik/commit | **tak** + weryfikacja wizualna |

Niepewny tier → zaokrąglaj w górę. Rozkład zweryfikowany 2026-07-11: 300-400 (~87 plików, 75%), 400-500 (~12), 500-600 (~9), 600-700 (~2), 700+ (~6, w tym reszta P5).

**Twardy checklist dla KAŻDEGO pliku, każdy tier** (zasady złamane wcześniej w realnych sesjach — nie pomijaj):
1. Przed edycją: `grep -c "notify(\|console\.warn(\|console\.error(" plik` — zapisz liczbę. Po rozbiciu suma we WSZYSTKICH nowych plikach musi być ≥ oryginalnej (dokładnie ten bug znaleziony w P5#1: zgubiony `notify()` w catch-u, niezłapany przez typecheck/lint/107 testów).
2. Po przeniesieniu: sprawdź `eslint.config.js` (`LEGACY_FILES`, `NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS`) i `legacy-lines-baseline.json` — nie śledzą `git mv` same. Nigdy nie dopisuj nowego pliku do `LEGACY_FILES` żeby ominąć limit.
3. Weryfikacja w kolejności: `typecheck:ui` → `eslint <dotknięte>` → `test` → `ratchet:frontend`, napraw przed kolejnym plikiem.
4. Tier 2/3: sprawdź że żaden `useState`/`useEffect` nie został zduplikowany między starym a nowym miejscem (copy-paste zamiast move).
5. Nie dotykaj `RichEditor.tsx`, `database.types.ts`. Zero zmian zachowania — bugi zauważone po drodze notuj osobno.

**Kadencja:** po każdym Tier 3 — stop, zgłoś. Po każdych 5 plikach Tier 1/2 — krótkie podsumowanie, jedź dalej.

## DS1/DS4 — reszta Design System 10/10 (częściowe)

Trwałe reguły (wzorce, tokeny, checklisty) → `docs/DESIGN_SYSTEM.md`. Tu tylko otwarta praca.

**DS1 (modale/spinnery/empty states) — częściowo zrobione, zostało (stan 2026-07-11):**
- **9 plików** z ręcznym `fixed inset-0`: `DailyShutdownModal.tsx`, `DashboardFastCapture.tsx`, `MorningPlanModal.tsx` (backdrop wizarda), `FoodEntryModal.tsx`, `SearchModal.tsx`, `InsightCard.tsx`, `EndMyopiaCalculator.tsx`, `ActionCenterSheet.tsx`, `WeeklyReviewModal.tsx`. Migruj proste header+content na `ui/Modal`; multi-step wizard (jak `WeeklyReviewModal`) — sprawdź czy `Modal` przyjmie `children` z własnym headerem (`showCloseButton={false}`) zamiast trwałego wyjątku.
- **25 plików** z `animate-spin` poza `ui/Spinner.tsx` — większość to legalne ikony Lucide (`Loader2`/`RefreshCw` z `animate-spin`), NIE kandydaci. Migruj tylko samodzielne `<div className="animate-spin rounded-full...">` bez ikony.
- **30 plików** z `border-dashed` poza `ui/EmptyState.tsx`/`todo/EmptyState.tsx` (ten drugi zostaje osobno, drag-target).

**DS4 (audyt responsywności) — sprawdzone: Kalendarz, Todo, Keep, Rozwój, Projekty, Dziś. Zostało:** Desktop (`/dashboard`), Growth do końca, Medical, Settings, Tydzień, Historia. Dla każdego, na 375px i 1280px: horizontal overflow, console errors (0 tolerowane), touch targets <44px (oceń gęstą nawigację jak akceptowalny wyjątek), sidebar chowa się poprawnie na mobile.

**DS6 (adopcja ciągła)** — bez końca, zasada skauta: dotykasz pliku z inline overlay/empty state/hardkodem koloru → przy okazji przepnij na wspólny komponent/token.

---

# Część V — Resolution Layer / Partner Mode

> Hard Freeze na `vanguard-auto-classify` i kod produkcyjny obowiązywał do 2026-07-10 17:00 UTC — **zdjęty**. Specyfikacja poniżej gotowa do wykonania.

## Cel

Telegram ma przestać być pasywnym Loggerem (surowe transkrypcje) i stać się Partnerem: przed odpowiedzią bot sprawdza graf faktów (`public.claims`) i stan biometryczny (Oura), więc odpowiedź odnosi się do realnego kontekstu.

Warunek konieczny: graf encji (`entities`/`entity_aliases`/`claims`) musi być spójny — jedna realna rzecz = jedna encja. Dziś tak nie jest.

## Diagnoza (zweryfikowana bezpośrednio w bazie)

- `entities`: 232 wiersze, wszystkie utworzone 2026-07-08.
- `entity_aliases`: **0 wierszy.** Trigger `tr_new_entity_alias` istnieje, ale 232 encje powstały zanim/bez tego by trigger je zasilił — Tier 1 (trigram) nie ma dziś na czym trafić.
- Duplikaty potwierdzone (zgodność `kind` + wysokie podobieństwo): `Cyberbezpieczenstwo` (concept) / `Cyberbezpieczeństwo` (inne) — sim 0.74; `Kinga` (person) / `Kuzynka Kinga` (person) — sim 0.46.
- Fałszywe alarmy odrzucone po sprawdzeniu `kind` (NIE scalać): `Analiza`/`Analiza Danych`/`Analityk Danych` — trzy różne pojęcia; `Siłownia` (place) / `siłownia_jutro`/`siłownia_w_sobotę`/`siłownia_w_niedzielę` (event) — miejsce vs wydarzenia w tym miejscu.

## Otwarte zadania

- [ ] Backfill `entity_aliases` dla istniejących 232 encji.
- [ ] Ręczny merge: Kinga/Kuzynka Kinga, Cyberbezpieczenstwo/Cyberbezpieczeństwo.
- [ ] Dodać krok B2 (fuzzy match + kind guardrail + confidence gap) do `resolve_entity()` + indeks GIN na `entity_aliases.alias`.
- [ ] Podłączyć `fetchWorldState()` w `queryOracle` zamiast ręcznego `Promise.all`.
- [ ] Dodać Resolution Layer (Tier 1 trigram / Tier 2 embedding+LLM) + odczyt `public.claims` do `queryOracle`.
- [ ] Deploy `vanguard-telegram` po weryfikacji powyższego.

---

# Część VI — Pomysły funkcjonalne (bank inspiracji, nieprzefiltrowany)

> Zebrane z analizy aplikacji konkurencyjnych (Motion, Sunsama, Reclaim, Whoop, TickTick, Exist, Logseq, Fabric, i inne). Złota zasada wdrożeń: **najcenniejsze funkcje to te, które wzmacniają wiele istniejących modułów jednocześnie** (łączą planowanie, refleksję, analitykę, integracje). App-of-origin to tylko etykieta, nie oś organizująca. Kanoniczna, posortowana wg dźwigni wersja: [`docs/direction/FEATURE_INSPIRATIONS.md`](docs/direction/FEATURE_INSPIRATIONS.md). Tu — surowy bank pomysłów po Tierach, do przeglądania przy szukaniu inspiracji.

**Priorytety Jakuba (2026-07-03):** (1) tygodniowy widok jako interaktywna siatka z blokami edytowalnymi w miejscu, sync z Google Cal w obie strony; (2) budżety sfer tygodnia (Praca/Trening/Relacje/Odpoczynek/Projekty) — "czy ten tydzień był ważny" = czy każda sfera dostała minimum; (3) automatyczne przypomnienia życiowe (polisa, przegląd, urodziny, cykliczne administracyjne); (4) matryca kontekstowa "co teraz najlepiej zrobić" (pora dnia + energia + czas, system filtruje nie decyduje).

## 🏆 S Tier — Core Engine

**★ Hexagonal Life Architecture (Vanguard Special):** przed tygodniem użytkownik nie planuje sztywnego kalendarza, tylko "rzeźbi" tydzień — budżety czasowe dla sfer życia (Praca, Ciało, Duch, Finanse, Relacje, Odpoczynek) przez interaktywny heksagon/radar. Kafelki priorytetowych zadań przeciągane bezpośrednio do sfer heksagonu odejmują czas z budżetu. Widok z lotu ptaka porównuje tygodnie ramię w ramię.

**Planowanie i przepływ zadań** (Sunsama/Motion/Reclaim/Rise Science): rollover counter + warning (≥3 przełożenia), pruning flow (decyzja rano/wieczorem na Telegramie: MIT / backlog / dropped), time estimation, capacity planning (dzienny budżet), task history log, objectives roll-forward (niedzielne podsumowanie), time-horizon backlog (tydzień/miesiąc/someday zamiast płaskiej listy), focus mode (jedno zadanie + timer), AI scheduling z auto-rescheduling, deadline-first scheduling, workload heatmapa, focus time defense (blokowanie spotkań w oknach pracy głębokiej), circadian peak scheduling (krzywa energii z Oura, sugestie *High Focus* tylko w oknach szczytowych).

**Prowadzenie i telemetria** (RoutineFlow/Super Productivity/Rize.io): interaktywne rutyny na Telegramie krok-po-kroku z przyciskami `[Zrobione]`/`[Pomiń]`, step timestamping, routine bottleneck analytics (szacowane vs rzeczywiste), adaptable routines wg energii, zero-touch focus quality tracker (monitoring aktywnych procesów desktop → Focus Score).

**Nawyki ilościowe** (TickTick/Exist/Way of Life): quantitative habits (wartości liczbowe, nie tylko checkbox), correlation engine (nawyki × biometria × nastrój, auto), habit heatmaps (GitHub-style), yes/no/skip status (nie zrywa streaku przy podróży).

**Pamięć cyfrowa** (Logseq/Fabric/MyMind): daily notes journaling, semantic search wektorowe po notatkach/linkach/zadaniach, AI auto-tagging linków bez udziału użytkownika.

## 🥈 A Tier — Wysoka wygoda i ergonomia

Eisenhower Matrix (2x2 drag-and-drop), smart filters (zapisywalne kryteria), subtask checklists + task templates, nested tags (`#finanse/faktury`), supertags (tag generuje pola formularza, np. `#książka` → autor/ocena/status). Internal calendar + daily timeline, daily summary digest mailem, smart buffers (decompression/travel time). Strain vs. recovery window (Whoop-style), sleep debt tracker, RPE workout logging, safe-to-spend calculator (PocketGuard-style). Spaced repetition daily review (5 losowych fragmentów), flashbacks/on this day, multimedia journaling (tekst + zdjęcie + lokalizacja).

## 🥉 B Tier — Rozbudowa zaawansowana

Pomodoro logs + floating focus widget, inbox webhooks + email-to-task parser (LLM), routine triggers + iOS shortcuts, task splitting, Beeminder commitment logic, knowledge graph visualizer (Obsidian-style), envelope budgeting (`/kup kawa 15` na Telegramie), mood & tag correlation, supertags fields render (dynamiczne formularze wg tagu).

## 🗛 C Tier — Estetyka i UX

White noise/Spotify/floating music widget, animowane widgety postępu, Milanote-style visual boards.

---

# Część VII — Zamknięte (archiwum krótkie)

Pełna historia w `git log`. Poniżej tylko punkty z kontekstem wartym zachowania (dlaczego coś zostało zrobione tak, nie inaczej — przydatne przy podobnej decyzji w przyszłości).

- **BACKLOG-01 (rozróżnienie typów obserwacji)** — QA 2026-05-17 znalazło false positives w `friction_events` (stan bez odchylenia, zachowanie bez intencji). Wdrożone: kolumna `event_kind` + taksonomia (`friction_event`/`state_observation`/`micro_behavior_observation`), prompt auto-classify z przykładami, `confirmed_friction_events` VIEW filtruje tylko `friction_event`+`positive_micro_action`. `vanguard-friction-qa` wyłączony jako cykliczny bot-raport — przyszły QA powinien być SQL/dashboard. Nie kasować obserwacji innych typów ze streamu — materiał do przyszłej analizy.
- **BACKLOG-03 (Oura timing)** — sleep_data_status jawnie sprawdzany przeciw najnowszemu rekordowi `oura_daily_summary`; gdy nieaktualny, kontekst pokazuje "pending — dane jeszcze nie zsynchronizowane".
- **BUG-01/BUG-02 (2026-05-23, `f1bb2b6`)** — `tomorrowWarsawDate` z `activePlanning.date + 1` zamiast UTC `setDate`; `vanguard-daily-reconciliation` guard wieczorny z cutoff 17:00 Warsaw.
- **Clarity-02 (2026-05-26)** — `vanguard-architect`: usunięty martwy `extractFrictionEvent`.
