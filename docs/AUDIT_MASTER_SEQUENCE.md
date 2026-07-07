# Vanguard OS — Audit Master Sequence

> Zebrane z sesji audytowej 2026-07-07 (audyt architektury + 5 rund głębokich znalezisk + weryfikacja w kodzie). Ten plik jest **jedynym** miejscem, gdzie "Master lista Partie 0-4" (56 punktów, do tej pory istniała tylko w czacie) jest zapisana, skorygowana i zsekwencjonowana razem z resztą audytu. Pisany tak, żeby agent widzący repo pierwszy raz wykonał wszystko w poprawnej kolejności bez czytania historii czatu.
>
> **Nie duplikuje treści** `docs/KNOWLEDGE_LEVERAGE_BACKLOG.md` (warstwa epistemiczna — claims, kalibracja, graf) ani `docs/BUG_TECH_DEBT_BACKLOG.md` (silent-fail/write-orphan) — do obu odsyła sekcjami. Duplikuje tylko tyle, ile potrzeba żeby kolejność była jednoznaczna.
>
> **Zasada kolejności:** to nie jest ranking "co ważniejsze". To jest graf zależności — pozycja niżej często wymaga tego co wyżej. Nie przeskakuj faz.

---

## Poprawki względem oryginalnej listy z czatu (przeczytaj najpierw — oszczędza pracę)

Zweryfikowane bezpośrednio w kodzie 2026-07-07. Jeśli widzisz te punkty w starszych notatkach/czacie, są **nieaktualne**:

| Punkt oryginalny | Status | Dowód |
|---|---|---|
| Partia 3 #23 „skonsolidować compute-* w vanguard-nightly" | **ZROBIONE** | `supabase/functions/vanguard-nightly/index.ts` istnieje, woła wszystkie `_shared/nightly/*` kroki |
| Partia 4 #32 „odkomentować vanguard_graph_cleanup, czeka od maja" | **ZROBIONE dziś** | `supabase/migrations/20260707160000_vanguard_graph_cleanup_restore.sql` — cron `vanguard-sunday-cleanup` już zaplanowany |
| Partia 4 #35 „zbudować globalne wyszukiwanie" | **JUŻ ISTNIEJE** | `src/components/.../SearchModal.tsx` wpięty w Dashboard + `vanguard-search` na backendzie. Zweryfikuj pokrycie zamiast budować od zera |

Zduplikowane punkty scalone w jedno zadanie (nie rób osobno):

| Duplikaty | Scalone jako |
|---|---|
| Partia 1 #9, #10, Ciągłe #42, #43 | Jedna reguła: `as any` zakaz + `*Api.ts` DAL + ESLint `no-explicit-any: error` + `max-lines`. Egzekucja = zasada skauta przy dotyku, nie jednorazowy sweep (patrz Faza 1) |
| Partia 2 #17, #18, #19 | Jeden model synchronizacji Oura (trio→jedna funkcja + desktop sync storm + drugi `gatherUserContext`) — Faza 0/3 |
| Partia 0 #4 i Partia 2 #19 | Ten sam bug (`gatherUserContext` wywoływany w dwóch miejscach: `OracleCard:351` i `usePowerListData`) — usuń oba na raz |
| Partia 0 #5 (`YOUR_SERVICE_ROLE_KEY` w cron metabolism) | Rozszerzone: to jest **wzorzec**, nie jednostkowy bug — patrz Faza 0 pkt 5 |

---

## FAZA 0 — Bezpieczeństwo i domknięcie sesji (dziś wieczorem, przed czymkolwiek innym)

1. **Backup** — nocny `pg_dump` (GitHub Action na cronie) + kopia bucketów (`progress-photos`, `todo-attachments`) + **test odtworzenia na czystym projekcie**. Punkt zero całego audytu.
2. **Zielony typecheck na main** — przywrócić `catch (e)` w `usePowerListData` (×3), `CalendarView:805`, typy `calendar-write` w `CalendarView:655-674`, `.message` w `Stats`. Zrób w tym samym przebiegu co Priorytet 1 z `docs/BUG_TECH_DEBT_BACKLOG.md` (`InsightsDashboard.tsx:63-82`, `GrowthView.tsx:230-234`, `PatternCard.tsx:38-47`) — to ten sam typ buga (niesprawdzone zapisy/catch), jeden sweep zamiast dwóch sesji.
3. **Git** — commit ~90 plików w paczkach tematycznych, rozładować 2 stashe. Od teraz czysty working tree przed każdą fazą.
4. **Delete `gatherUserContext`** z `OracleCard:351` **i** z `usePowerListData` (drugie wystąpienie tego samego wzorca — 15 zapytań do kosza przy każdym otwarciu/pytaniu). Rób oba na raz, to jeden bug klasy, nie dwa zadania.
5. **Sekrety/URL placeholdery w migracjach — pełny sweep, nie jeden plik.** Znane przypadki: cron `metabolism` (`YOUR_SERVICE_ROLE_KEY`) i `trigger_daily_snapshots` (`supabase/migrations/20260513000001_daily_snapshot_cron.sql`, URL zawiera dosłowny `YOUR_PROJECT_REF`, funkcja wciąż ma `GRANT EXECUTE ... TO service_role` potwierdzony w `20260611213502_p2_hygiene_advisories.sql`). Zrób `grep -rn "YOUR_PROJECT_REF\|YOUR_.*_KEY\|YOUR_.*_SECRET" supabase/migrations` i napraw **wszystkie** trafienia w jednej sesji — to jest powtarzalny wzorzec błędu, nie pojedynczy incydent.
6. **Deploy + migracje zaległe** (`realtime_publication`, `metabolism_flag`, cron) + deploy `oracle`/`executor`/`metabolism`.
7. **Test dwóch magii** — task z Telegrama pojawia się sam w otwartej apce; odpowiedź Oracle płynie strumieniem.
8. **`VANGUARD_USER_ID` fail-fast** — wyjątek zamiast fallbacku na usera-ducha `0000...`.

---

## FAZA 0.5 — Repo↔Prod integrity audit (NOWE — musi być przed jakąkolwiek dalszą konsolidacją)

**Dlaczego to jest tuż po Fazie 0, przed wszystkim innym:** zweryfikowano w kodzie dwa niezależne dowody tego samego wzorca strukturalnego:
- `scripts/ops/e2e-daily-loop.mjs:132,171` testuje `compute-daily-strain` i `save-daily-aggregate` — funkcje bez źródła w repo (skonsolidowane do `vanguard-nightly`, ale heartbeat o tym nie wie).
- `supabase/migrations/20260704171601_cron_vanguard_detect_patterns.sql` (sprzed 3 dni) planuje cron uderzający w `/functions/v1/vanguard-detect-patterns` — nazwa, której **nigdy nie było** w repo jako osobny plik.
- `supabase/functions/vanguard-backtester/` — katalog istnieje, **zero plików źródłowych**.

To nie jest jeden zepsuty cutover. To brak mechanizmu, który wiązałby stan repo ze stanem produkcji. Każda kolejna konsolidacja (Oracle write-back, backtester, cokolwiek z Faz 2-4) wpadnie w tę samą dziurę, jeśli nie naprawisz przyczyny.

**Kroki:**
1. Pełny audyt jednym przebiegiem: `list_edge_functions` (Supabase MCP) vs `ls supabase/functions/*` w repo → wypisz **wszystkie** rozbieżności naraz (funkcje na serwerze bez źródła w repo, funkcje w repo niewdrożone, cron targety bez odpowiednika w żadnym z dwóch).
2. Dla każdej rozbieżności: jeśli funkcja realnie działa na serwerze i ma wartość (np. `vanguard-backtester`, jeśli istnieje mimo pustego katalogu) — ściągnij kod zamiast pisać od zera. Jeśli nie istnieje nigdzie — zaktualizuj/usuń to, co na nią wskazuje (`e2e-daily-loop.mjs`, `smoke-manifest.mjs`, migracja `cron_vanguard_detect_patterns`).
3. **Zbuduj deploy ledger** — nawet najprostszy: tabela lub plik `deployed_functions(name, git_sha, deployed_at, deployed_by)` aktualizowana ręcznie przy każdym deployu (`docs/runbooks/deploy-edge-function.md` dostaje krok 0: zapisz do ledgera przed deployem). Sprawdzone: CI (`ci.yml`) nigdy nie deployuje funkcji ani nie robi `db push` — deploy jest w 100% ręczny i nigdzie nie zostawia śladu. To jest przyczyna źródłowa, nie objaw — bez tego ten sam typ rozjazdu wróci.
4. Heartbeat: przestań testować HTTP OPTIONS/200 na same funkcje — przepnij na czytanie `vanguard_pipeline_runs` (ledger nightly, patrz Faza 2 pkt 1). Testowanie "czy funkcja odpowiada" nie sprawdza, czy praca została wykonana — dokładnie ta klasa problemu, którą właśnie znalazłeś.

---

## FAZA 1 — Strażnicy procesu (tydzień 1)

9. **Reguły agentów w `CLAUDE.md`** (już częściowo są) + **ESLint jako prawo**: `max-lines` 300/150, `no-explicit-any: error`, lista LEGACY-wyjątków która może tylko maleć. To jedno zadanie łączące dawne Partia 1 #9/#10 z Ciągłe #42/#43 (`*Api.ts` warstwa dla 223 rozsianych `.from()`, 170× `as any`, `@ts-nocheck` w `exportStats.ts`) — **egzekucja per plik przy dotyku (zasada skauta), nie jednorazowy sweep całego repo.**
10. **Knip do CI** + wyczyścić martwe pliki/eksporty, które wskaże.
11. **Jawne `verify_jwt` per funkcja** w `config.toml` — dziś tylko część z 42 funkcji ma jawny wpis (`vanguard-telegram*`, `vanguard-daily-reconciliation`, `vanguard-auto-classify`, `vanguard-push-reminder`, `vanguard-architect`); sprawdź resztę.
12. **Logowanie kosztów LLM** — `usage` z każdej odpowiedzi do tabeli.
13. Heartbeat→Telegram przy failu — **już przeprojektowane w Fazie 0.5 pkt 4**, nie osobne zadanie.
14. **`_pending_faza1`** — 3 migracje w limbo od maja: apply albo delete.

---

## FAZA 1.5 — Knowledge Leverage, Priorytet 1

Pełny opis, kod, pliki i kolejność już napisane w `docs/KNOWLEDGE_LEVERAGE_BACKLOG.md` §1.1–§1.3. Wykonaj w tej kolejności (1.3 wymaga 1.1 jako warunku):

1. **§1.1** Write-back `proposed_memory` z `ClarificationRequest` do grafu wiedzy — największa dźwignia/koszt całego audytu (~1 wieczór), odblokowuje ścieżkę zamkniętą od Sprint 0.7.
2. **§1.2** Kalibracja prognoz (Brier/MAE) — metryka nadrzędna, mówi Ci później czego jeszcze naprawdę brakuje.
3. **§1.3** Pompa active learning (`vanguard_wiki_review_items` → `oracle_clarification_requests`).

---

## FAZA 2 — Domknięcie rozliczeń

Pełny opis w `docs/KNOWLEDGE_LEVERAGE_BACKLOG.md` §2.1–§2.3:

1. **§2.3** Nightly pipeline ledger (`vanguard_pipeline_runs`) — scalone z Fazą 0.5 pkt 4 (heartbeat czyta ten ledger).
2. **§2.2** `vanguard-backtester` — krok 1 (audyt repo↔prod) już zrobiony w Fazie 0.5; teraz krok 2-3 (odzyskaj kod z serwera albo napisz od zera, dopiero PO §2.1 i bitemporalności z Fazy 4, inaczej backtester nie ma czego oceniać uczciwie).
3. **§2.1** Rada Oracle'a jako obiekt (`oracle_recommendations`) zamiast telemetrii read-only.
4. **NOWE — backfill/replay dla danych pochodnych.** Sprawdzone: `runComputeDailyStrain` i siostrzane `metrics_*` przyjmują tylko "dziś", nie zakres dat. Istniejące "backfille" to jednorazowe bespoke skrypty (`scripts/ops/backfill-food-llm-entries.ts`, `scripts/analysis/backfill_triads.mjs`), nie ogólny mechanizm. Dodaj `dateFrom/dateTo` do funkcji `_shared/nightly/metrics_*.ts`, nightly dostaje tryb `?backfill=X..Y`. **Rób razem z `algo_version`** (Faza 4) — jedna migracja, jeden PR: wersjonowanie formuły bez zdolności przeliczenia historii jest bezużyteczne.

---

## FAZA 3 — Model pojemności + struktura frontendu

Kolejność wewnątrz fazy jest krytyczna — **dokończ react-query przed routerem i offline queue**, inaczej dwa równoległe modele cache się gryzą:

1. `docs/KNOWLEDGE_LEVERAGE_BACKLOG.md` §7.1 — dokończyć migrację z ręcznych `useEffect+useState` (29 hooków w `src/hooks/`) na react-query.
2. Partia 2 #16 — router zamiast ręcznej nawigacji (stan w URL, deep-linki).
3. Partia 2 #17+#18 — trio Oura → jedna funkcja + desktop sync storm (scalone, patrz tabela duplikatów wyżej).
4. Partia 2 #20 — offline write queue (react-query persist + mutation queue).
5. Partia 2 #21 — skróty PWA (`/?todo=new`, share_target).
6. Partia 2 #22 — miniatury client-side przy uploadzie.
7. `docs/KNOWLEDGE_LEVERAGE_BACKLOG.md` §3.1–§3.2 — model pojemności (effort na zadaniach + `useAIScheduling` podłączony do recovery/world_state). Odblokowuje jednym prymitywem trzy pozycje naraz: planner, scheduling, Partia 3 #51 (nightly pisze bloki kalendarza).

---

## FAZA 4 — Graf wiedzy i backtester (przy najbliższym dotknięciu architekta/wiki-compilera)

`docs/KNOWLEDGE_LEVERAGE_BACKLOG.md` §4.1–§4.9, w tej kolejności:

1. **§4.6** Tabela encji — **sprawdź najpierw `vanguard_entity_aliases`** (opisana jako martwa w `docs/BUG_TECH_DEBT_BACKLOG.md`, sekcja write-orphany) zanim zbudujesz nową — może to już jest fundament, tylko niedopięty.
2. **§4.5** Bitemporalność (`learned_at`) — **rób razem z `algo_version`** (kolumna na danych pochodnych typu strain/aggregates, żeby backtest nie mieszał formuł) i z backfill/replay z Fazy 2 pkt 4. Jedna sesja, trzy powiązane problemy tej samej klasy ("przyszłość przecieka do przeszłości").
3. **§4.1** Warstwa `claims` jako nadrzędna nad graf/wiki/fundament/metabolism-beliefs (5 magazynów dziś).
4. **§4.2** Korelacje/patterns emitują claims — most FE-numeryczny ↔ graf-językowy.
5. **§4.3 + §4.4** `outcome_metric` per pattern + fix brakującego `user_id` w `outcomes.ts` (przy tej samej edycji pliku).
6. **§4.7** Dossier celu (`page_type: 'goal'` w wiki-compilerze).
7. **§4.8** Tygodniowy diff self-modelu — prefill do `WeeklyReviewModal` (Partia 4 #30).
8. **§4.9** 4 Lenses do promptu analyst/oracle — 15 minut, tylko tekst.

Partia 3, pozostałe punkty:
- #24 `pattern_events` — już częściowo istnieje (`outcomes.ts`), fix przy §4.4.
- #25 `world_state` jako tabela zamiast 8 kart z osobnymi fetchami.
- #26 `dailyPlanProposal` × world_state — odblokowane przez model pojemności (Faza 3).
- #27 Shutdown redesign (prefill z systemu).
- #28 Backtest odpalić po deployu — dopiero po §2.2 kroku 3.
- #29 Testy top 5 edge functions.

---

## FAZA 5 — Uczciwość danych, ludzie/świat zewnętrzny, ostatnie mile

`docs/KNOWLEDGE_LEVERAGE_BACKLOG.md` §5.1–§5.6 (braki danych, coverage metryk, korekty LLM, cykliczność, pogoda, confoundery) i §6.1–§6.2 (maraton jako obiekt, raport dla trenera Igora).

Partia 4, pozostałe punkty (z korektami z tabeli na górze):
- #30 Weekly digest → `WeeklyReviewModal` — prefill teraz dostępny z §4.8.
- #31 `dream_id` auto-sugestia albo wycięcie.
- #33 Cmentarz martwych tabel (schemat `graveyard`, po row-count) + regeneracja `database.types.ts`.
- #34 Jeden przełyk capture (Telegram/share/skróty/voice = aliasy jednej rury).
- ~~#35 globalne wyszukiwanie~~ — **już istnieje**, patrz korekty wyżej. Zamiast budować: zweryfikuj pokrycie (czy `vanguard-search` indeksuje wszystkie relevantne tabele).
- #36 Telemetria `view_events`.
- #37 keep-triage → LinksInbox auto-tagowanie.
- #38 Cele żywieniowe → `MorningPlanModal`.
- #39 Panel zdrowia systemu z `audit_events` — **bundle z §5.2** (licznik pokrycia metryk) w ten sam panel.
- #40 Sprzątanie repo (`.mimocode`, `screeny/`, `PRPs/`, `examples/`, skrypty jednorazowe).

**NOWE — budżet/kolejka powiadomień.** Zweryfikowano: co najmniej 8 niezależnych funkcji (`vanguard-analyst`, `vanguard-auto-classify`, `vanguard-nutrition-coach`, `vanguard-daily-reconciliation`, `vanguard-push-reminder`, `vanguard-weekly-synthesis`, `vanguard-librarian`, `vanguard-executor`, `vanguard-eval-interview`) woła Telegram API bezpośrednio, bez wspólnej bramki. Dziś znośne, ale rośnie liniowo z każdym nowym cronem (już 15). Tabela `outbound_messages(priority, dedupe_key, send_after)` + jeden worker wysyłający — każda funkcja *proponuje*, nie wysyła bezpośrednio.

---

## Ciągłe / po sierpniu (zasada skauta — nie osobna sesja per punkt)

Partia "Ciągłe" #41, #44–#56 bez zmian względem oryginału, poza:

- **#45 (LLM gateway + rejestr promptów)** — rozszerz o dwie rzeczy znalezione w audycie infrastruktury:
  1. **Centralizacja sekretów** — `DEEPSEEK_API_KEY` i podobne czytane `Deno.env.get(...)` bezpośrednio w ~30 osobnych plikach funkcji zamiast przez jeden `_shared/config.ts`. Rotacja klucza dziś = grep-and-replace pod presją w 30 plikach. Zrób przy budowie gatewaya, nie osobno.
  2. **Tier wrażliwości danych** — prompty medyczne/rodzinne/tożsamościowe (`medicalContext.ts`, `user_fundament`) idą dziś do tego samego vendora (DeepSeek) co wszystko inne. Jedna kolumna w rejestrze promptów, decyzja raz.
- Reszta punktów (#41, #44, #46–#56) — bez zmian, wykonuj przy dotyku odpowiedniego modułu.

---

## Zasada zamykająca

Po Fazie 1.5 (§1.2 — kalibracja prognoz) masz obiektywny sygnał, czego jeszcze brakuje: jeśli krzywa błędu predykcji się wypłaszcza, to znak że modelowi głoduje konkretna zmienna — **dopiero wtedy** dokładaj nowy sensor (pogoda z Fazy 5, lokalizacja, cokolwiek). Nie odwrotnie.

Ten plik zastępuje potrzebę kolejnych rund audytu architektury/epistemiki na jakiś czas. Jeśli coś nowego się znajdzie, dopisz je do właściwej Fazy z uzasadnieniem zależności (co blokuje, co odblokowuje) — nie jako płaski punkt na końcu listy.
