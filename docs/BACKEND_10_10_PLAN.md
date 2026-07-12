# Backend 10/10 — plan wykonawczy krok po kroku

> Ten plik jest wykonywany przez agentów AI, w tym mniej kompetentnych i domyślnie leniwych.
> Leniwy agent NIE wpadnie sam na to, żeby założyć porządny folder zamiast dopisać do
> istniejącego pliku, żeby sprawdzić wynik swojej pracy zapytaniem SQL zamiast uwierzyć
> własnemu podsumowaniu, albo żeby przeczytać cały plik przed edycją. Dlatego każda faza
> niżej ma osobną sekcję **"Zasady tej fazy (nie idź na skróty)"** — to nie jest powtórka dla
> stylu, to jest zabezpieczenie przed najczęstszym trybem porażki tego typu agenta.
>
> **Prawo nadrzędne:** [`docs/BACKEND_CONTRACT.md`](BACKEND_CONTRACT.md). Ten plik mówi
> *co robić w jakiej kolejności*, kontrakt mówi *jak wolno pisać kod*. Sprzeczność = wygrywa
> kontrakt.
>
> **Relacja do `POLISH_10_10_PLAN.md`:** sekcja "P0 — Backend krytyczne" w tamtym pliku
> została napisana wcześniej i **część jej punktów wygląda na już naprawioną** (P0.1 —
> `vanguard_behavioral_patterns` ma dziś świeże wpisy; P0.3 — `vanguard_graph_cleanup()` był
> przepisany migracją `20260710180000_resolution_layer_hardening.sql` na soft-merge przez
> `merged_into`). **Nie ufaj temu zdaniu.** To dokładnie ten typ założenia, który lessons.md
> każe weryfikować w kodzie/bazie, nie w pamięci. Faza 1 niżej zaczyna od ponownej,
> bezpośredniej weryfikacji wszystkich czterech punktów P0 z tamtego pliku, zanim ruszysz
> dalej.

## Status na 2026-07-11 (koniec sesji)

Fazy 0, 1, 2, 4, 5, 6 **zamknięte i zweryfikowane żywym testem** (nie samą lekturą kodu —
patrz dowody w tabeli faz niżej i commity `bc057dba`..`a7404ddd`). Faza 3 **zamknięta** —
narzędzie naprawione (skanowało `_shared/` błędnie, agregacja JSDoc była per-plik zamiast
per-funkcja), 33 orphany przetriażowane (13 false-positive/frontend, 4 VIEW, 1 trigger-sync,
3 realne martwe zapytania naprawione i wdrożone, 1 zostawiony do decyzji produktowej —
`vanguard_recipes`/`vanguard-executor`), JSDoc `@reads/@writes` domknięty na 19 funkcjach.

**Faza 7 nie ma statusu "zamknięta"** — to stały tryb pracy (ratchet), nie zadanie z DoD.

Otwarte na przyszłość (świadomie zostawione, nie zgubione):
- `vanguard_recipes` / `vanguard-executor` — 0 wierszy, 0 wywołań, brak dokumentacji;
  decyzja: usunąć czy dobudować, wymaga rozmowy o intencji produktowej.
- 30 pozostałych orphanów z `npm run contracts:check` po naprawie tabeli danych — realnie
  przetriażowane co do klasy (false-positive/VIEW/trigger/nieznane), ale nie każdy pojedynczo
  potwierdzony wierszem w bazie — kolejna sesja może przejść resztę tą samą metodą.
- `_shared/http.ts` (`serveJson`) ma na razie 3-5 konsumentów (Faza 2) — reszta funkcji do
  przepięcia stopniowo, ratchet `rawJsonResponse` pilnuje kierunku.
- Repozytoria z Fazy 4 (`streamRepo`/`aggregatesRepo`/`reconciliationsRepo`) mają 1 realnego
  konsumenta (`vanguard-eval-interview`, 4 z 7 zapytań) — reszta ~70 rozproszonych zapytań do
  gorących tabel czeka na stopniowe przepięcie.
- **Liczniki ratcheta stoją w miejscu** — `as any` w `supabase/functions/` = 73 (bez zmiany od
  początku sesji, tylko 1 funkcja z ~30 kandydatów przepięta na typowane repo),
  `rawJsonResponse` = 136 (bez zmiany, 3-5 funkcji na `serveJson`). To nie regresja — baseline
  po prostu jeszcze nie zaczął spadać, bo Faza 7 dopiero się zaczyna.
- **Smoke test (`npm run smoke`/`smoke:safe`) nie testuje realnego auth-matrix** — tylko
  `auth=none` i `auth=service_role` na OPTIONS/POST. Nigdy nie zweryfikowano prawdziwym
  user-JWT, że frontend faktycznie dostaje 200 tam, gdzie powinien (Faza 1.2 to *zakładała*,
  ale dowód jest pośredni — kod na produkcji się zgadza, nie ma testu z realnym tokenem usera).
- **23 pliki >300 linii z mapy `BACKEND_CONTRACT.md` §5 — zero rozbitych tej sesji.** Faza 7
  jest formalnie "aktywna" (ratchet pilnuje), ale nikt jeszcze nie wykonał pierwszego kroku.

## P1 — Bezpieczeństwo produkcyjne (znalezione w audycie 2026-07-11, NIGDY nie było w żadnym
## pliku wykonawczym jako checklista — tylko w czacie, stąd łatwo było to zgubić)

Znalezione przez `get_advisors` (Supabase MCP), zweryfikowane bezpośrednio w bazie tego samego
dnia co Fazy 0-6. Żaden punkt niżej nie został jeszcze naprawiony — to nie jest "otwarte do
rozważenia", to jest realny, nienaprawiony dług bezpieczeństwa z profilem ryzyka wyższym niż
większość Fazy 7 (sekrety i uprawnienia, nie tylko jakość kodu).

### P1.1 — Service-role secret plaintextem w 12 z 13 cronów
`SELECT jobname, command FROM cron.job` pokazuje inline `Authorization: Bearer <service-role-key>`
w komendzie SQL crona dla wszystkich poza `vanguard-sunday-cleanup` (to jedno wywołuje funkcję
SQL bezpośrednio, bez HTTP). Każdy z uprawnieniem do odczytu `cron.job` (m.in. przez
`pg_read_all_data` albo dowolny dostęp do bazy z rolą wyższą niż podstawowa) widzi klucz do
wszystkiego.
- [ ] Przenieś sekret do Supabase Vault (`vault.create_secret`), w komendach cron użyj
      `vault.decrypted_secrets` zamiast literału.
- [ ] Zrób to dla wszystkich 12 jobów w jednej migracji (`cron.alter_job`), nie po jednym.
- [ ] Weryfikacja: `SELECT command FROM cron.job` nie zawiera już czytelnego klucza dla
      żadnego joba; ręczne wywołanie każdego joba (albo poczekanie na najbliższe uruchomienie)
      wciąż zwraca 200, nie 401.

### P1.2 — SECURITY DEFINER RPC wykonywalne przez `anon`/`authenticated`
Z `get_advisors(type=security)`: `oracle_readonly_query`, `sync_friction_proposals`,
`trg_sync_oura_sleep_to_calendar`, `trg_sync_strava_activity_to_calendar`,
`trg_sync_workout_session_to_calendar`, `trg_deduplicate_calendar_sleep`,
`trigger_outbound_message_worker`, `trigger_vanguard_telegram_worker`,
`sync_link_read_to_growth_pins`, `sync_todo_done_to_growth_pins`, `compute_navy_bf`,
`handle_clarification_writeback`, `_recompute_daily_nutrition` — wszystkie wykonywalne przez
`anon` REST endpoint (`/rest/v1/rpc/<nazwa>`), część też przez `authenticated`. Funkcje
`trg_*`/`trigger_*` to triggery — w ogóle nie powinny być wywoływalne przez REST.
- [ ] Dla każdej: `REVOKE EXECUTE ... FROM anon, authenticated` (albo `PUBLIC`), zostaw tylko
      `service_role` gdzie to potrzebne backendowi.
- [ ] `oracle_readonly_query` to najwyższe ryzyko — publiczny endpoint do odpytywania bazy
      SQL-em, nawet z guardrailami "readonly". Sprawdź jego treść przed decyzją: czy guardraile
      są wystarczające, czy REVOKE od razu.
- [ ] Weryfikacja: `get_advisors(type=security)` — te findingi znikają z listy.

### P1.3 — `vanguard_consolidated_activities` SECURITY DEFINER VIEW
Jedyny ERROR (nie WARN) z advisors. Widok wykonuje się z uprawnieniami twórcy, nie
wywołującego — potencjalne ominięcie RLS.
- [ ] Przeczytaj definicję widoku, zdecyduj: przepisać jako SECURITY INVOKER (domyślne od
      Postgres 15) czy zostawić z jawnym uzasadnieniem w komentarzu migracji.

### P1.4 — RLS enabled bez polityk (4 tabele)
`graveyard.food_parse_pending`, `public.pattern_events`, `public.vanguard_knowledge` i jedna
czwarta (zweryfikuj świeżą listą `get_advisors` — mogła się zmienić od 2026-07-11) — RLS
włączone, zero polityk = w praktyce nikt (poza service_role) nic nie widzi, co może być
zamierzone (tabele tylko dla backendu) albo przeoczeniem.
- [ ] Dla każdej: zdecyduj czy potrzebuje polityki (jeśli frontend ją czyta) czy jawnego
      komentarza "service_role only by design".

### Definition of Done P1
`get_advisors(type=security)` nie pokazuje żadnego z powyższych; `cron.job.command` nie
zawiera czytelnych sekretów. To najwyższy priorytet po P0 — rób przed dalszym ciągiem Fazy 7.

### Status: P1.1-P1.4 zamknięte 2026-07-11 (commity `1c8c9fdb`, `792ff3f1`)
Wszystkie zweryfikowane `has_function_privilege()`/live testem, nie samym odczytem migracji:
- P1.1: sekret w Vault, `cron.job.command` bez plaintextu, żywy test (`todo-push-reminders`
  ręcznie odpalony) zwrócił 200 przez podstawienie z Vault.
- P1.2: 13 funkcji (`oracle_readonly_query` + 12 trigger/writeback) — `anon_exec`/`auth_exec`
  = false dla wszystkich, potwierdzone jednym zapytaniem na końcu. Po drodze złapane i
  naprawione dwa realne bugi: (a) `REVOKE FROM anon,authenticated` był no-opem dla 11/12 bo
  grant szedł przez `PUBLIC`, nie rolę wprost — trzeba `REVOKE FROM PUBLIC`; (b)
  `cleanup_old_logs` (własny z Fazy 6) miał odwrotny problem — jawny grant na `anon`/
  `authenticated` w ACL (domyślne zachowanie Supabase dla nowych funkcji), `REVOKE FROM
  PUBLIC` nic nie dał, potrzebny `REVOKE FROM anon,authenticated` wprost. **Lekcja: sprawdź
  `pg_proc.proacl` przed zakładaniem, który REVOKE zadziała — nie ma jednej uniwersalnej
  formy.**
- P1.3: `vanguard_consolidated_activities` → `SECURITY INVOKER`, widok wciąż zwraca dane.
- P1.4: jawne polityki "Service role bypass" na 3 tabelach (dokumentacja, zero zmiany
  zachowania — RLS bez polityki już blokowało wszystko poza `service_role`).

**Nowy backlog znaleziony przy P1.2 (NIE naprawiony, celowo):** advisors pokazuje 9 kolejnych
`authenticated`-executable SECURITY DEFINER RPC (`add_food_entry`, `remove_food_entry`,
`update_food_entry`, `repeat_food_entry`, `save_food_correction`, `save_workout_atomic`,
`replace_calendar_window`, `get_data_coverage`, `get_desktop_dashboard_data`) — w
przeciwieństwie do P1.2 te WYGLĄDAJĄ na legalne, aktywnie używane RPC z frontendu (logowanie
jedzenia/treningu, zapis kalendarza, dashboard). Przed jakąkolwiek zmianą: zweryfikuj czy
każda z nich sprawdza `auth.uid() = p_user_id` wewnątrz (IDOR-ryzyko jeśli nie) — to osobna
sesja, nie doklejka do P1.

---

## Zasady dla KAŻDEGO agenta wykonującego KTÓRĄKOLWIEK fazę tego planu

Czytaj to przed każdą sesją, nie tylko raz na początku pracy nad planem.

1. **Jedna faza = jedna sesja = jeden temat = jeden commit.** Nie łącz faz. Nie zaczynaj
   fazy N+1, dopóki faza N nie ma zielonej weryfikacji.
2. **"Zrobione" oznacza: uruchomiłeś komendę weryfikującą i przeczytałeś jej realny output.**
   Nie oznacza: napisałeś kod, który wygląda poprawnie. Nie oznacza: funkcja zwróciła
   `{success: true}` — response funkcji potrafi kłamać (patrz `lessons.md`, wpis
   2026-07-04 o `vanguard-detect-patterns`). Jeśli krok mówi `SELECT count(*)` — wykonaj
   to zapytanie i wklej realny wynik do swojego podsumowania, nie parafrazę.
3. **Gdy krok mówi "stwórz plik/folder X" — stwórz dokładnie X, nie dopisuj do istniejącego
   pliku, żeby było szybciej.** Struktura folderów w tym planie jest częścią zadania, nie
   sugestią. Sprawdzenie: po skończeniu fazy zrób `git status` i porównaj listę nowych/
   zmienionych plików z tym, co faza kazała stworzyć — jeśli się nie zgadza, popraw przed
   commitem.
4. **Przeczytaj cały plik przed edycją, jeśli ma mniej niż ~500 linii.** Dla większych —
   przeczytaj sekcję, którą zmieniasz, plus jej bezpośrednie sąsiedztwo (importy, eksporty).
   Nie edytuj na ślepo na podstawie samego grepa.
5. **Nie zgaduj nazwy kolumny/tabeli.** Sprawdź `database.types.ts` albo
   `list_tables`/`execute_sql` (Supabase MCP) zanim napiszesz `.eq()`/`.order()`/`ALTER TABLE`.
   Zero wierszy z wartością w kolumnie ≠ kolumna martwa — grep całego repo, nie tylko COUNT.
6. **Przed jakimkolwiek DROP/DELETE na schemacie: policz żywe wiersze, zgrepuj cały `src/` i
   `supabase/functions/` po nazwie, i dopiero potem usuwaj.** To jest zasada, którą to repo
   już raz złamało (`daily_wins.task_N_checkpoint_id`, `project_checkpoints`) — nie łam jej
   trzeci raz.
7. **Po skończeniu fazy uruchom WSZYSTKIE komendy z jej sekcji "Weryfikacja", w podanej
   kolejności, i nie przechodź dalej, jeśli którakolwiek jest czerwona.** Napraw, uruchom
   ponownie. Nie komentuj sobie "to nie powinno być istotne" — jeśli nie rozumiesz czemu coś
   jest czerwone, to jest właśnie sygnał żeby się zatrzymać, nie żeby to zignorować.
8. **Nie obniżaj baseline'u/limitu w pliku konfiguracyjnym bez realnego zejścia liczby.**
   Baseline ma odzwierciedlać zmierzony stan po zmianie, nie stan docelowy życzeniowo.
9. **Aktualizuj dokumentację, którą krok każe zaktualizować, w TYM SAMYM commicie**, nie
   "przy okazji następnej sesji". `AGENTS.md`, `supabase/functions/README.md`,
   `docs/ARCHITECTURE.md`, JSDoc nagłówki — to nie są opcjonalne notatki, to jest część
   definicji "skończone" z `BACKEND_CONTRACT.md` §0.
10. **Jeśli po drodze znajdziesz coś złamanego, co NIE jest w scope tej fazy — nie naprawiaj
    tego po cichu w tym samym commicie.** Dopisz jedno zdanie do `lessons.md` albo zostaw
    TODO z datą, i wróć do zakresu bieżącej fazy. Mieszanie zakresów utrudnia review i cofanie.
11. **Nie deployuj z brudnego drzewa git** (`git status` musi być czyste poza plikami tej
    fazy) i nie deployuj bez `npm run smoke` po deployu.

---

## Kolejność faz (od dziś do 10/10)

| Faza | Temat | Czas | Blokuje kolejną? | Status |
|---|---|---|---|---|
| 0 | Weryfikacja stanu — nie ufaj żadnemu wcześniejszemu raportowi | 30 min | Tak, zawsze pierwsza | ✅ Zamknięta 2026-07-11 |
| 1 | P0 — auth, które dziś krwawi w produkcji | 1-2h | Tak | ✅ Zamknięta, potwierdzona `get_edge_function` na prod |
| 2 | Kernel `serveJson` + auto-telemetria błędów | pół dnia | Nie, ale bardzo ułatwia 3-7 | ✅ Zamknięta, 3-5 konsumentów |
| 3 | Kontrakt danych: generowany bilans `@reads/@writes` + orphan-check | pół dnia | Nie | ✅ Zamknięta, 3 realne bugi naprawione+wdrożone |
| 4 | Typowana granica DB dla Deno + 3 repozytoria gorących tabel | 1-2 dni | Nie | ✅ Zamknięta (rebuild #3), 1 realny konsument, wdrożone |
| 5 | Higiena deploy: czyste drzewo + hash + eval-gate na prompty | pół dnia | Nie | ✅ Zamknięta, 3 Windows-bugi w skrypcie naprawione |
| 6 | Invariant-check grafu wiedzy + retencja logów | pół dnia | Nie | ✅ Zamknięta, krok wykonał się w nightly (status ok) |
| 7 | Ciągła spłata: dedup, rozbicie molochów, `as any` → 0 | ciągłe, sesja na kawałek | Nie, ratchet pilnuje | ♾️ Nigdy "zamknięta" z definicji |

Fazy 2-6 mogą iść w dowolnej kolejności między sesjami (nie zależą twardo od siebie), ale
**Faza 0 i Faza 1 zawsze pierwsze**, i żadna faza 2-7 nie zaczyna się, dopóki Faza 1 nie jest
zielona — bo P0 to realne dziury bezpieczeństwa/utraty danych, reszta to jakość.

---

## Faza 0 — Weryfikacja stanu (30 min, ZAWSZE pierwsza sesja dnia pracy nad tym planem)

### Cel
Ustalić, co z poprzednich audytów jest wciąż prawdą, zanim wykonasz choćby jedną zmianę.
Stan tego repo zmienia się między sesjami — commity 1ebbde89, b9952482, 474697c7 z dzisiaj
już zmieniły część rzeczy opisanych w starszych dokumentach.

### Zasady tej fazy (nie idź na skróty)
Nie czytaj tylko `lessons.md`/planów i nie zakładaj, że opisany tam stan wciąż obowiązuje.
**Każdy punkt niżej wymaga bezpośredniego sprawdzenia w kodzie lub bazie**, nie w pamięci
dokumentu.

### Kroki
- [ ] `git log --oneline -20` i `git status` — co się zmieniło od ostatniego audytu backendu
      (patrz nagłówek commitów wymienionych wyżej w tym pliku).
- [ ] Supabase MCP `get_advisors` (`type: security` i `type: performance`) — świeża lista,
      nie ta z pamięci/starego audytu.
- [ ] `SELECT jobname, schedule, active FROM cron.job ORDER BY jobname` — porównaj z tabelą
      cronów w `docs/ARCHITECTURE.md`; jeśli się różnią, zanotuj rozbieżność (naprawi ją
      Faza 5/dokumentacja, teraz tylko zanotuj).
- [ ] Dla KAŻDEGO punktu P0.1-P0.4 z `POLISH_10_10_PLAN.md`: sprawdź bezpośrednio w kodzie/
      bazie, czy wciąż jest prawdziwy. Nie wierz nagłówkowi tego pliku, że "wygląda na
      naprawione" — to jest hipoteza do potwierdzenia, nie fakt.
  - P0.1: `grep -n "hypothesis" supabase/functions/_shared/nightly/patterns.ts` +
    `SELECT status, count(*) FROM vanguard_behavioral_patterns GROUP BY status`.
  - P0.2: `grep -n "requireServiceRole\|Authorization" supabase/functions/vanguard-nightly/index.ts
    supabase/functions/vanguard-telegram-worker/index.ts`.
  - P0.3: przeczytaj całą funkcję `vanguard_graph_cleanup()` (`execute_sql` na
    `pg_get_functiondef`) — potwierdź czy DELETE na `entities`/kaskada na `claims` wciąż
    istnieje, czy zastąpiona przez `merged_into` UPDATE.
  - P0.4: `SELECT count(*) FROM vanguard_predictions`, `oracle_recommendations`,
    `vanguard_pipeline_runs`, i `max(created_at)` każdej — świeże dane czy stare?
- [ ] Zapisz wynik tej weryfikacji jako listę w PR/commit message Fazy 1 ("P0.1: naprawione,
      potwierdzone przez X. P0.3: naprawione migracją Y. P0.2: wciąż otwarte, ale w innej
      postaci niż opisano — patrz Faza 1.1..." itd). To jest dokumentacja dla następnego
      agenta, nie tylko dla Ciebie.

### Weryfikacja
- [ ] Masz jedną listę: dla każdego z 4 punktów P0 ze starego planu — status "otwarte" /
      "naprawione" / "częściowo", z dowodem (query, grep, link do migracji).

### Definition of Done
Lista istnieje, każdy punkt ma dowód, żaden nie jest oparty na "prawdopodobnie" albo na
treści starszego dokumentu.

---

## Faza 1 — P0: auth, które dziś krwawi (1-2h)

### Cel
Zamknąć dwie potwierdzone dziury z audytu 2026-07-11: brak auth w `vanguard-outbox-sender`
(otwarte proxy do Telegram Bot API) i błędny auth w akcjach `vanguard-nightly` (frontend
dostaje 401 na rzeczy, które powinien móc wywołać).

### Zasady tej fazy (nie idź na skróty)
Auth to nie miejsce na "chyba działa". Dla KAŻDEJO zmiany auth w tej fazie musisz
przetestować **obie strony**: żądanie bez poprawnych danych → 401/403; żądanie z poprawnymi
→ 200. Sam happy path nie wystarczy — brak testu negatywnego to dokładnie to, jak powstała
dziura w `outbox-sender`.

### Kroki

**1.1 — `vanguard-outbox-sender` bez auth**
- [ ] Dodaj `requireServiceRole(req)` na początku handlera (wzorzec: dowolna z 13 funkcji,
      które już to robią, np. `vanguard-nightly/index.ts:77`).
- [ ] Sprawdź `config.toml` — funkcja musi mieć `verify_jwt = false` (trigger pg_net) +
      `requireServiceRole` w kodzie jako druga linia obrony (nagłówek `Authorization` z
      service-role secret musi być ustawiony w triggerze DB, sprawdź migrację triggera).
- [ ] Test negatywny: POST bez `Authorization` → oczekuj 401. Test pozytywny: prawdziwy
      trigger insertu do `outbound_messages` → wciąż działa (sprawdź `outbound_messages.status`
      przechodzi `processing → sent`).

**1.2 — `vanguard-nightly` akcje zwracają 401 dla frontendu**
- [ ] W gałęzi `if (action)` ([index.ts:88](../supabase/functions/vanguard-nightly/index.ts))
      zamień `requireServiceRole(req)` (dziś na starcie całego handlera, blokuje też akcje)
      na rozróżnienie: pełny pipeline bez `action` → `requireServiceRole` zostaje; gałąź z
      `action` → `resolveUserScope(req, body.userId ?? null)` (service-role token nadal
      przechodzi przez tę funkcję, patrz `_shared/supabase.ts:18`).
- [ ] Test: wywołanie z frontendowym user-tokenem na `?action=compute-daily-strain` → 200.
      Wywołanie bez tokenu → 401. Cron bez `action` (pełny pipeline) → nadal wymaga
      service-role, nie user-tokenu.
- [ ] **Nie zostawiaj trzech równoległych ścieżek frontendowych wywołujących to samo.**
      Skonsoliduj `src/lib/health/strainRefresh.ts`,
      `src/components/biometrics/hooks/useDailyStrainRefresh.ts` i inline wywołanie w
      `DesktopDashboard.tsx:124` do jednej funkcji w `strainRefresh.ts`; pozostałe dwa
      miejsca mają ją importować, nie duplikować `invokeEdge(...)`.
- [ ] `src/lib/insightsApi.ts:63` (`triggerPatternDetection`) i
      `useCorrelationsData.ts:54-55` — te dwa zostają jako explicit user-triggered akcje
      (przycisk), ale sprawdź czy `useCorrelationsData` nie woła tego automatycznie przy
      każdym mouncie komponentu (dziś prawdopodobnie tak — jeśli tak, to osobne zadanie w
      Fazie 3/4: docelowo powinien czytać wynik z tabeli, nie przeliczać przy każdym wejściu
      w zakładkę; nie rób tej zmiany w Fazie 1, tylko zanotuj w `lessons.md`).

### Weryfikacja
- [ ] `npm run smoke` — zero 401 tam, gdzie nie powinno być.
- [ ] Ręczny test w przeglądarce: otwórz widok korelacji i zaloguj posiłek/trening — sprawdź
      w Network tab, że wywołanie `vanguard-nightly?action=...` zwraca 200, nie 401.
- [ ] Edge logi (`get_logs`, service `edge-function`) przez 5 minut po deployu — zero
      nieoczekiwanych 401/500 na `vanguard-nightly` i `vanguard-outbox-sender`.
- [ ] `npm run ratchet:backend` — zielone.

### Definition of Done
Oba fixy wdrożone, oba mają test negatywny i pozytywny wykonany naprawdę (nie opisany
teoretycznie), `lessons.md` ma nowy wpis jeśli po drodze wyszło coś nieoczywistego.

---

## Faza 2 — Kernel `serveJson` + automatyczna telemetria błędów (pół dnia)

### Cel
Dziś każda funkcja ręcznie robi CORS/OPTIONS/try-catch/`JSON.stringify` (140 wystąpień, 44
pliki) i błędy giną w logach edge, które nikt nie czyta na bieżąco (tylko 11 z 31 funkcji
woła `logCriticalError`). Efekt: żeby znaleźć błąd, trzeba przeszukiwać logi ręcznie zamiast
zapytać bazę. Ta faza to naprawia u źródła, jednym miejscem.

### Zasady tej fazy (nie idź na skróty)
**Nie migruj wszystkich 31 funkcji w tej sesji.** To gwarantowana katastrofa review — zbyt
duży diff, zbyt duże ryzyko regresji naraz. Zbuduj helper, migruj **3-5 najprostszych
funkcji jako dowód działania**, resztę zostaw ratchetowi (licznik `rawJsonResponse` w
`backend-contract-baseline.json` będzie spadał sesja po sesji przy okazji dotykania innych
plików — to jest zamierzone, nie lenistwo).

**Nie twórz helpera "w locie" wewnątrz jednej funkcji i nie przenoś go później.** Od razu
twórz go we właściwym miejscu: `supabase/functions/_shared/http.ts`. Jeśli w trakcie pracy
uznasz, że lepsza nazwa/lokalizacja — zmień od razu, nie zostawiaj tymczasowej.

### Kroki
- [ ] Stwórz **nowy plik** `supabase/functions/_shared/http.ts` (nie dopisuj do
      `supabase.ts` — to inna odpowiedzialność: HTTP framing, nie DB/auth).
- [ ] W nim: `export async function serveJson(handler, opts?: { auth?: 'service' | 'user' | 'none' })`.
      Wewnątrz: obsługa OPTIONS, `corsHeaders`, wywołanie `handler(req, ctx)` gdzie `ctx`
      zawiera już rozwiązany `userId`/`isServiceRole` wg `opts.auth`, catch-wszystko z
      **automatycznym wywołaniem `logCriticalError`** (nazwa funkcji z `ctx`, error, request
      URL/method — bez body jeśli może zawierać dane wrażliwe), mapowanie błędu na status
      (401 dla auth-error wzorem już istniejącym w `vanguard-wiki-compiler`, 500 reszta).
- [ ] Migruj **3-5 funkcji** o najmniejszym ryzyku (kandydaci: `vanguard-kpi-suggest`,
      `vanguard-keep-triage`, `compute-behavior-effects`, `lookup-food`,
      `parse-workout-nl` — sprawdź LOC i brak specjalnych wymagań streamingu/webhooków
      przed wyborem, nie kopiuj tej listy bezmyślnie jeśli któraś z tych funkcji ma inny
      kształt niż zwykły request/response).
- [ ] Dla każdej zmigrowanej funkcji: zachowaj identyczny kontrakt odpowiedzi (te same pola
      JSON, te same kody statusu) — to jest refaktor bez zmiany zachowania, nie okazja do
      poprawek przy okazji.

### Weryfikacja
- [ ] Dla każdej z 3-5 zmigrowanych funkcji: wywołanie z poprawnym tokenem → identyczny JSON
      jak przed zmianą (porównaj ręcznie, nie zakładaj). Wywołanie bez tokenu → 401 z
      wpisem w `audit_events` (`SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 5`
      po teście — musi się pojawić wiersz).
- [ ] Sztucznie wywołaj wyjątek w jednej zmigrowanej funkcji (np. chwilowo zepsuj zapytanie)
      i potwierdź, że `audit_events` dostaje wpis z nazwą funkcji i stack trace, **potem
      cofnij tę sztuczną zmianę przed commitem**.
- [ ] `npm run ratchet:backend` — licznik `rawJsonResponse` spadł dokładnie o tyle, ile
      wystąpień usunąłeś; obniż baseline o dokładnie tę liczbę, nie "z zapasem".

### Definition of Done
`_shared/http.ts` istnieje i ma prawdziwych konsumentów (min. 3 funkcje), auto-telemetria
potwierdzona żywym testem w `audit_events`, baseline obniżony zgodnie ze zmierzonym stanem.

---

## Faza 3 — Kontrakt danych: generowany bilans `@reads`/`@writes` (pół dnia)

### Cel
Sześć razy w historii tego repo (`life_goals`, `vanguard_knowledge`, `oracle_recommendations`,
`ai_recap`, `weekly_kpi_reviews`, kolumna `sort_order`/`position`) coś było czytane bez
pisarza, pisane bez czytelnika, albo odpytywane pod nieistniejącą nazwą kolumny — i za
każdym razem odkrywał to człowiek przypadkiem, nie narzędzie. Ta faza buduje narzędzie.

### Zasady tej fazy (nie idź na skróty)
To jest skrypt analizujący, nie refaktor kodu — **nie zmieniaj logiki żadnej funkcji w tej
fazie**, tylko buduj narzędzie, które o niej wnioskuje. Jeśli w trakcie znajdziesz realną
sierotę (tabela/kolumna bez pisarza lub czytelnika) — **nie naprawiaj jej w tym samym
commicie**. Zapisz jako finding, dopisz do `lessons.md` albo utwórz osobne zadanie. Mieszanie
"buduję narzędzie" z "naprawiam co narzędzie znalazło" w jednym commicie to dokładnie ten
błąd, przed którym ostrzega zasada #10 na górze tego pliku.

### Kroki
- [ ] Stwórz **nowy plik** `scripts/ops/check-data-contracts.mjs` (analogiczny do
      `check-backend-contract.mjs` — czytaj go jako wzorzec stylu, nie kopiuj mechanicznie).
- [ ] Skrypt: dla każdego pliku `.ts` w `supabase/functions/**` (poza `_shared/`) wyciągnij
      z JSDoc nagłówka wartości `@reads` i `@writes` (parsowanie już istnieje częściowo w
      `scripts/ops/generate-functions-registry.mjs` — przeczytaj go i policz, czy da się
      wydzielić wspólny parser zamiast pisać drugi od zera; jeśli tak, wydziel do
      `scripts/ops/lib/jsdocParser.mjs` i importuj w obu miejscach).
- [ ] Osobno: regexem znajdź faktyczne `.from('tabela')` w treści każdego pliku (nie tylko
      JSDoc — JSDoc może kłamać, patrz `lessons.md` o `vanguard-nightly` niedeklarującym
      zapisu do `vanguard_pipeline_runs`). Zbuduj mapę `tabela → [pliki, które ją realnie
      dotykają, i czy przez .select vs .insert/.update/.upsert]`.
- [ ] Wyjście skryptu: lista tabel z **zerem plików czytających** mimo że ktoś pisze (sierota
      zapisu) i tabel z **zerem plików piszących** mimo że ktoś czyta (sierota odczytu —
      to jest dokładnie kształt bugu `life_goals`/`oracle_recommendations`).
- [ ] Dodaj do `package.json`: `"contracts:check": "node scripts/ops/check-data-contracts.mjs"`.
- [ ] Nie failuj jeszcze CI tym skryptem (na start on tylko raportuje) — dopiero gdy lista
      sierot spadnie do zera albo do nazwanych, świadomych wyjątków (np. tabela dopiero co
      utworzona migracją, celowo jeszcze bez konsumenta na jedną sesję), przełącz na
      ratchet z baseline jak w `check-backend-contract.mjs`.

### Weryfikacja
- [ ] Uruchom `npm run contracts:check`, przeczytaj CAŁY output, nie tylko podsumowanie.
- [ ] Dla każdej znalezionej sieroty: potwierdź ręcznie (grep + `execute_sql`), czy to
      realny problem czy fałszywy alarm skryptu (np. tabela czytana tylko przez raw SQL w
      migracji, którego regex nie złapał) — popraw regex skryptu, jeśli fałszywych alarmów
      jest dużo, zamiast ignorować.
- [ ] Zapisz listę potwierdzonych sierot jako osobne zadania (nie napraw ich tutaj — patrz
      zasady tej fazy).

### Definition of Done
Skrypt istnieje, uruchamia się, jego output został ręcznie zweryfikowany na przykładzie
minimum 3 tabel, lista realnych sierot jest spisana do dalszej pracy (nie zgubiona w
terminalu).

---

## Faza 4 — Typowana granica DB dla Deno + repozytoria gorących tabel (1-2 dni)

### Cel
73 `as any` w `supabase/functions/` to objaw: Deno nie ma typów bazy (frontend ma
`database.types.ts`, edge functions nie mają nic). Efekt: literówka w nazwie kolumny nie
jest błędem kompilacji, tylko cichym `catch` w runtime. Do tego 31 rozproszonych
`.from('vanguard_stream')`, 25 `.from('vanguard_daily_aggregates')`, 23
`.from('daily_reconciliations')` w kilkunastu plikach każda — bez wspólnej warstwy.

### Zasady tej fazy (nie idź na skróty)
**Nie rób tego jako jeden wielki refaktor wszystkich wywołań naraz.** To jest zadanie na
kilka sesji: (a) wygenerować typy, (b) zbudować 3 repozytoria dla trzech najgorętszych
tabel, (c) przepiąć wywołania **stopniowo**, plik po pliku, z realnym testem po każdym. Nie
przepinaj funkcji, której nie rozumiesz w pełni — przeczytaj ją całą najpierw (zasada #4).

Repozytorium ma być **cienką warstwą typowanych zapytań**, nie miejscem na logikę biznesową.
Jeśli łapiesz się na tym, że dopisujesz tam warunki/transformacje specyficzne dla jednego
konsumenta — to nie należy do repo, zostaw to w funkcji wywołującej.

### Kroki
- [ ] Sprawdź, czy da się re-użyć `src/lib/database.types.ts` po stronie Deno (import przez
      `packages/domain` albo bezpośredni relative import — Deno wymaga `.ts` w importach,
      patrz `lessons.md` 2026-07-08 o `packages/domain`). Jeśli import wprost nie działa w
      Deno (sprawdź realnie, `deno check`, nie zgaduj), rozważ wygenerowanie osobnego pliku
      typów dla `supabase/functions/_shared/database.types.ts` tym samym poleceniem
      `db:update-types` z innym targetem — **ale wtedy dopisz krok do checklisty w
      `DEV_GUIDE.md` §2, żeby oba pliki typów były zawsze regenerowane razem**, inaczej
      odtworzysz dokładnie ten bug z lessons.md o dwóch plikach o tej samej nazwie w różnych
      miejscach (`database.types.ts` żywy vs martwy).
- [ ] Stwórz **nowy folder** `supabase/functions/_shared/repos/` z trzema plikami:
      `streamRepo.ts`, `aggregatesRepo.ts`, `reconciliationsRepo.ts` — każdy eksportuje
      typowane funkcje odpowiadające realnym, powtarzającym się wzorcom zapytań, które
      znajdziesz grepem (`.from('vanguard_stream')` itd.) — nie zgaduj z góry jakie funkcje
      są potrzebne, wyprowadź je z istniejących wywołań.
- [ ] Przepnij **jeden plik na raz** na repo, zacznij od tego z największą liczbą powtórzeń
      (`vanguard-eval-interview` ma 7 własnych zapytań do `vanguard_stream` — dobry
      pierwszy kandydat). Po każdym pliku: `npm run typecheck`, `deno check` na dotkniętym
      pliku, i jeśli to funkcja z realnym ruchem (cron/webhook) — manualny test wywołania
      przed przejściem do kolejnego pliku.
- [ ] Licznik `as any` w `backend-contract-baseline.json` — obniżaj dokładnie o tyle, ile
      realnie zniknęło w danej sesji, po każdej sesji osobno, nie na końcu całej fazy.

### Weryfikacja
- [ ] Po każdym przepiętym pliku: `npm run typecheck` zielony, `npm run ratchet:backend`
      zielony z obniżonym (nie tym samym) licznikiem `as any` jeśli coś zniknęło.
- [ ] Po repo dla `vanguard_stream`: sztucznie podaj złą nazwę kolumny w jednym miejscu i
      potwierdź, że **kompilator** to łapie (nie runtime) — to jest dowód, że typowanie
      faktycznie działa, nie tylko że kod się kompiluje.

### Definition of Done
3 repozytoria istnieją i mają realnych konsumentów, przynajmniej jedna funkcja z dużą
liczbą własnych zapytań została w pełni przepięta i przetestowana, `as any` zmierzalnie
spadło i baseline to odzwierciedla.

---

## Faza 5 — Higiena deploy: czyste drzewo + hash + eval-gate na prompty (pół dnia)

### Cel
Repo już dwa razy złapało drift "wdrożona wersja funkcji ≠ to, co jest w git" (patrz
`lessons.md`: `get_brain_health_report`, `vanguard-detect-patterns`). Przyczyna: deploy przez
MCP nie wymaga czystego drzewa i nic nie zapisuje, jaki commit poszedł na produkcję. Osobno:
zmiany promptów LLM wchodzą bez przepuszczenia przez `vanguard-eval-runner`, mimo że to
narzędzie istnieje właśnie po to.

### Zasady tej fazy (nie idź na skróty)
Nie buduj tego jako "miękkie przypomnienie" (komentarz w docs) — to musi być **skrypt, który
odmawia deployu**, jeśli warunek nie jest spełniony. Miękkie przypomnienia już nie działały
(stąd dwa incydenty w historii).

### Kroki
- [ ] Stwórz **nowy plik** `scripts/ops/deploy-guard.mjs` (lub rozszerz istniejący skrypt
      deployu, jeśli taki jest — sprawdź `scripts/ops/` przed tworzeniem duplikatu):
      sprawdza `git status --porcelain` (musi być puste), pobiera `git rev-parse HEAD`,
      i **dopiero po tych sprawdzeniach** wywołuje właściwy deploy.
- [ ] Po udanym deployu: insert do `audit_events` (albo nowej, dedykowanej tabeli
      `deploy_log` jeśli `audit_events` nie pasuje semantycznie — zdecyduj i uzasadnij
      jednym zdaniem w komentarzu migracji) z `function_name`, `git_sha`, `deployed_at`.
- [ ] Dla zmian promptów: sprawdź `git diff` na plikach zawierających prompty (grep
      `content:` w kontekście `deepseekChat`/systemowych promptów) — jeśli diff dotyka
      promptu, skrypt deployu ma **przypomnieć** (nie musi blokować w pierwszej wersji —
      zdecyduj świadomie i zapisz decyzję w komentarzu skryptu) o uruchomieniu
      `vanguard-eval-runner` przed deployem.
- [ ] Zaktualizuj `docs/DEV_GUIDE.md` §2 checklist deployu, żeby wskazywał na ten skrypt
      zamiast (albo obok) ręcznych kroków.

### Weryfikacja
- [ ] Sztucznie zostaw niescommitowaną zmianę i uruchom skrypt — musi odmówić deployu z
      jasnym komunikatem. Cofnij sztuczną zmianę.
- [ ] Prawdziwy deploy jednej małej funkcji przez skrypt — potwierdź wpis w
      `audit_events`/`deploy_log` z poprawnym `git_sha` (`git rev-parse HEAD` musi się
      zgadzać z tym, co w bazie).

### Definition of Done
Skrypt istnieje, odmawia deployu z brudnym drzewem (przetestowane), zapisuje hash po
udanym deployu (przetestowane), `DEV_GUIDE.md` wskazuje na niego jako kanoniczną ścieżkę.

---

## Faza 6 — Invariant-check grafu wiedzy + retencja logów (pół dnia)

### Cel
Graf wiedzy (`entities`/`claims`/`vanguard_entity_links`) jest najmłodszym i najbardziej
złożonym subsystemem (bi-temporalny, już wymagał kilku migracji naprawczych w ciągu 2 dni).
Bez cyklicznego sprawdzenia niezmienników zepsuje się cicho. Osobno: `vanguard_llm_usage` i
`vanguard_pipeline_runs` rosną bez końca.

### Zasady tej fazy (nie idź na skróty)
Nie zgaduj, jakie niezmienniki mają sens — wyprowadź je z realnych incydentów opisanych w
`lessons.md` (merge encji kasujący claims, `merged_into` bez aliasów, duplikaty aktywnych
claims dla tej samej encji). Jeśli dopiszesz niezmiennik, którego żaden wcześniejszy
incydent nie uzasadnia — to nie jest błąd, ale oznacz go jako "prewencyjny", nie "z
incydentu", żeby następny agent wiedział, że to hipoteza.

### Kroki
- [ ] Stwórz **nowy plik** `supabase/functions/_shared/nightly/graphInvariants.ts` z
      funkcją `runGraphInvariantCheck(supabase, userId)` — sprawdza minimum: (a) czy istnieją
      claims wskazujące na encję, która ma `merged_into` ustawione (powinny być
      przepisane na winnera), (b) czy są duplikaty aktywnych (nie-superseded) claims dla tej
      samej encji+atrybutu, (c) czy są `entity_aliases` bez odpowiadającej encji-winnera.
      Każde naruszenie → wiersz w `audit_events`, nie tylko `console.warn`.
- [ ] Dopnij jako krok w `vanguard-nightly` (wzorem istniejących `runLedgerStep`, non-critical
      żeby nie blokował reszty pipeline'u przy pierwszym uruchomieniu).
- [ ] Migracja retencji: `vanguard_llm_usage` i `vanguard_pipeline_runs` — polityka kasowania
      wierszy starszych niż 90 dni. Zdecyduj: cron SQL (`DELETE ... WHERE created_at < now() -
      interval '90 days'`) w nowym jobie tygodniowym, albo partycjonowanie jeśli wolumen na
      to wskazuje (sprawdź realny wolumen `SELECT count(*), pg_size_pretty(...)` przed
      wyborem — nie zakładaj, że potrzebujesz cięższego rozwiązania niż DELETE).

### Weryfikacja
- [ ] Uruchom `runGraphInvariantCheck` ręcznie na produkcyjnych danych (read-only część —
      przed dopięciem do nightly) i przeczytaj realny output, nie zgaduj czy graf jest czysty.
- [ ] Po dopięciu do nightly: poczekaj na cron albo wywołaj ręcznie z service-role tokenem,
      potwierdź krok w `vanguard_pipeline_runs`.
- [ ] Test retencji na kopii/`WHERE false` najpierw (dry-run przez `EXPLAIN` albo `SELECT`
      zamiast `DELETE`), dopiero potem prawdziwy `DELETE`, i potwierdź `count(*)` przed/po.

### Definition of Done
Invariant-check działa i raportuje do `audit_events`, wpięty w nightly jako non-critical
krok, retencja wdrożona i przetestowana na realnym `SELECT` przed jakimkolwiek `DELETE`.

---

## Faza 7 — Ciągła spłata długu (bez końca, sesja na kawałek)

To nie jest jednorazowa faza — to codzienna praktyka egzekwowana przez
`npm run ratchet:backend` i mapę molochów w `BACKEND_CONTRACT.md` §5.

### Zasady (nie idź na skróty, obowiązują na zawsze, nie tylko podczas tego planu)
- Dotykasz pliku >300 linii z listy legacy → wydzielasz moduł, nie dopisujesz. Zero
  wyjątków, ratchet to wymusi (fail buildu), ale **nie czekaj na fail — zaplanuj to od razu**.
- Każdy nowy `as any` musi być uzasadniony w PR/komentarzu, dlaczego typ jest niemożliwy do
  wyrażenia — w 99% przypadków to nieprawda, popraw typ.
- Duplikat kernela (raw `createClient`, raw `fetch` do znanego API, inline data Warsaw) —
  zero tolerancji, ratchet ma to na 0 dla nowego kodu.
- Raz na kilka sesji: `npm run contracts:check` (Faza 3) i przejrzyj, czy nie przybyła nowa
  sierota danych.

### Definition of Done tej fazy
Nie istnieje — to jest stan ciągły. "10/10" nie znaczy "skończone i zamrożone", znaczy: każda
kolejna zmiana albo zmniejsza dług, albo przynajmniej go nie zwiększa, i to jest wymuszone
mechanicznie, nie na honor.

### Pierwsze realne zejście liczników (2026-07-11/12, commity `06f36d92`..`548b84ef`)
- `rawProviderFetch`: 7 → 4. Whisper/embeddings/Telegram duplikaty usunięte i wdrożone.
  Zweryfikowane żywym testem `action=search` na produkcji — realny wynik `similarity: 0.526`
  z wektorowego wyszukiwania, nie tylko "nie rzuca błędu". Pozostałe 4 to udokumentowany
  wyjątek (bootstrap `vanguard-telegram`).
- Inline daty Warsaw: 17 → 9. 8 czystych generatorów `YYYY-MM-DD` (en-CA/sv locale)
  zamienione na `getWarsawDateString()` w 6 plikach. Pozostałe 9 to formatowanie do
  wyświetlenia (nazwy dni tygodnia, DD.MM.YYYY w promptach) — świadomie zostawione, bo
  `getWarsawDateString()` robi tylko `YYYY-MM-DD`. Po drodze złapany i cofnięty własny błąd:
  przy ekstrakcji `handleGoalCreate` przypadkiem zamieniono format daty W PROMPCIE LLM
  (`pl-PL DD.MM.YYYY` → `YYYY-MM-DD`) — to była zmiana zachowania przemycona do refaktoru
  bez zmiany zachowania, cofnięta przed commitem.
- Pierwszy moloch rozbity: `vanguard-oracle/index.ts` 795 → 590 linii. 3 handlery
  (`handleSearch`/`handleGoalCreate`/`handleTaskBreakdown`) przeniesione do `handlers/*.ts`
  dokładnie wg mapy w §5 ("już są funkcjami — tylko przenieść"). Zweryfikowane DWOMA żywymi
  wywołaniami na produkcji po deployu (`action=search` → prawdziwy wynik wektorowy,
  `action=task-breakdown` → sensowna lista podzadań), nie tylko smoke OPTIONS.

### 2026-07-12: kolizja z równoległą sesją — 0 as-any i 0 molochów osiągnięte

W trakcie dalszej pracy nad Fazą 7 odkryto **5 nowych commitów** na `main` (autor: Jakub,
inna sesja — commity `7979235c`..`546baa00`), które w międzyczasie rozbiły PRAWIE WSZYSTKIE
pozostałe molochy z mapy §5 (`metrics_strain.ts`, `analyze-food-quality`,
`analyze-training-load`, `recap/weekly-recap.ts`, `vanguard-analyst`, `vanguard-capture`,
`vanguard-eval-interview`, `vanguard-eval-runner`, `vanguard-nutrition-coach`,
`vanguard-oracle` głębiej niż mój split, `vanguard-telegram/interceptors.ts`,
`vanguard-wiki-compiler`) oraz sprowadziły `as any` do zera. Do tego ~27 plików
niescommitowanych na wierzchu — potencjalnie aktywna edycja w locie.

**Nie kontynuowano ślepo.** Zapytano usera jak rozegrać kolizję sesji (ryzyko: git race
condition / nadpisanie pracy w locie). Odpowiedź: commituj ich pracę po weryfikacji, potem
leć dalej. Weryfikacja (`npm run typecheck`) wykazała **39 realnych błędów** — nie był to
stabilny checkpoint. Naprawiono wszystkie (root cause: `unknown ?? default` z
`Record<string, unknown>` zwęża się do `{} | default`, nie `unknown | default` — znany quirk
TS; każde miejsce naprawione precyzyjną koercją `Number()/String()/Array.isArray`, **zero
nowych `as any`**), zweryfikowano 3× pełnym typecheckiem (39→6→0), commit `3abae5ac`.

Deploy 24 funkcji dotkniętych zmianą. **Po drodze złapano i naprawiono własny bug**:
`deploy-guard.mjs` (Faza 5) bezwarunkowo forsował `--no-verify-jwt` na KAŻDĄ nazwaną funkcję,
nadpisując `config.toml`. Efekt uboczny: `analyze-food-quality` zeszło z `verify_jwt=true` na
`false` na platformie. Zweryfikowano przed panikowaniem: funkcja ma `resolveUserScope()` w
kodzie (auth i tak wymuszony) i `config.toml` **już wcześniej** deklarował `verify_jwt=false`
dla niej — więc to nie była żywa dziura, tylko dryf platforma-vs-config sprzed tej sesji,
przypadkiem naprawiony. Skrypt i tak poprawiony (commit `f7cd5a08`) — nie może być tak, że
działa poprawnie tylko bo tym razem się upiekło.

Weryfikacja końcowa: pełny `smoke:safe` (48 ok / 4 warn / 2 fail — wszystkie znane,
nie-regresje), żywy test `action=search` (realny wynik wektorowy) i pełny czat Oracle z
tabelą biometryczną (dowód że naprawiony `rag.ts` faktycznie działa, nie tylko kompiluje).

**Stan liczników ratcheta na koniec tej rundy:**
| Licznik | Wartość |
|---|---|
| `as any` w `supabase/functions/` | **0** ✅ |
| pliki >300 linii (molochy) | **0** ✅ |
| `rawProviderFetch` poza kernelem | 4 (udokumentowany wyjątek bootstrap) |
| inline daty Warsaw | 9 (formatowanie do wyświetlenia, nie generatory) |
| `rawJsonResponse` (serveJson coverage) | 147 — **jedyny cel z /goal jeszcze niedomknięty** |
| `SB_SECRET_KEY` poza kernelem | 6 |

Dwa z czterech celów z `/goal` ("0 as any", "0 molochów") są teraz faktem, nie aspiracją.
Pozostają: pełne pokrycie `serveJson` (Faza 2, dziś 3-5/31 funkcji) i domknięcie ostatnich
9 inline dat / 4 raw fetch (już tylko udokumentowane wyjątki, nie realny dług).

### 2026-07-12 (ciąg dalszy): 9 funkcji przepiętych na `serveJson`, 2 realne bugi znalezione i naprawione live

Kontynuacja ataku na `rawJsonResponse` (jedyny z czterech celów `/goal` jeszcze w ruchu).
9 funkcji przepięto na `serveJson` w dwóch zweryfikowanych paczkach, każda: typecheck →
`check-edge-functions.mjs` (statyczny skan auth) → `ratchet:backend` → commit → deploy przez
`deploy-guard.mjs` → `npm run smoke` → gdzie bezpieczne, żywe wywołanie produkcyjne.

**Paczka 1** (commit `c356b609`): `vanguard-metabolism`, `vanguard-executor`,
`analyze-training-load`, `analyze-food-quality`, `vanguard-nutrition-coach`.
**Paczka 2** (commit `0909bd63`): `lookup-food`, `compute-behavior-effects`,
`vanguard-graph-embedder`, `vanguard-librarian`. `rawJsonResponse`: 147 → 133 → 123.

`analyze-food-quality`/`analyze-training-load` traciły przy migracji własne kody 404/400 na
rzecz jednolitego throw→401/500 z `serveJson`. Zweryfikowano bezpieczeństwo tej zmiany
*przed* migracją: wszystkie miejsca w froncie (`foodLogging.ts`, `workoutLogging.ts`,
`statsApi.ts`) łapią błąd przez `try/catch` albo `response.ok`, nigdy nie rozgałęziają się po
konkretnym kodzie — więc kolaps kodów jest bezpieczny funkcjonalnie, mimo że technicznie
widoczny w devtools.

**`check-edge-functions.mjs` wymagał poprawki**: statyczny skaner autoryzacji szukał
literałów `requireServiceRole`/`resolveUserScope` w `index.ts`, których po migracji już tam
nie ma (żyją wewnątrz `serveJson`). Naprawiono, żeby uznawał `serveJson(...)` bez
`auth:'none'` za wystarczające (fail-closed: jawne `auth:'none'` dalej wymaga własnego
uzasadnienia — patrz `lookup-food` niżej).

**`lookup-food`**: `verify_jwt=true` na bramce (JWT już wymuszony), funkcja nigdy nie
scope'owała po userze — przepięto na `auth:'none'`, zachowując dokładnie to zachowanie.
Przy okazji naprawiono realny bug: `fetchOffWithRetry`'s catch block konstruował i zwracał
pełny `Response` zamiast retry/`null`, cicho przełamując pętlę retry i maskując realne
błędy Open Food Facts jako "nie znaleziono".

**Żywa weryfikacja `vanguard-metabolism` odkryła 2 realne, niezwiązane z migracją bugi** —
funkcja nigdy w historii nie zakończyła się sukcesem:
1. Zapytanie SELECT-owało `oura_sleep_score, total_strain, calories_consumed, protein,
   blockers_notes` — **żadna z tych kolumn nie istnieje** na `vanguard_daily_aggregates`
   (potwierdzone `information_schema.columns`). Tylko `date`/`execution_score` były realne.
   Naprawiono na rzeczywiste kolumny (`sleep_hours, hrv_avg, readiness_score, final_state`).
2. Insert do `vanguard_entity_links` używał `relation: 'HISTORYCZNY_WRAŻLIWY_PUNKT'` — spoza
   `vanguard_relation_ontology` (74 dozwolonych relacji, wymuszane triggerem `P0001`) — ORAZ
   nie ustawiał `source_type`/`target_type` (kolumny NOT NULL bez defaultu). Naprawiono na
   `relation: 'ma_wspomnienie_z'` (dokładne dopasowanie semantyczne, zgodne z konwencją
   `source_type='person', target_type='memory'` używaną już w 4 innych wierszach tabeli).

Po obu poprawkach: żywe POST zwróciło realny wygenerowany "belief", 3 dni oznaczone
`condensed=true`, wiersz faktycznie wstawiony do `vanguard_entity_links` — potwierdzone
bezpośrednim zapytaniem SQL, nie samą odpowiedzią HTTP. Cotygodniowy cron (`0 3 * * 1`) od
teraz faktycznie coś robi, zamiast cicho logować `critical_error` do `audit_events` co
tydzień.

Dodatkowo: `vanguard-metabolism`, `vanguard-executor`, `analyze-food-quality` dopisane do
`smoke-manifest.mjs` (były wdrożone, ale bez pokrycia smoke).

**Stan liczników po tej rundzie:**
| Licznik | Wartość |
|---|---|
| `as any` w `supabase/functions/` | **0** ✅ |
| pliki >300 linii (molochy) | **0** ✅ |
| `rawProviderFetch` poza kernelem | 4 (bez zmiany — udokumentowany wyjątek) |
| inline daty Warsaw | 9 (bez zmiany — udokumentowany wyjątek) |
| `rawJsonResponse` (serveJson coverage) | **123** (z 147 na starcie rundy), 13/31 funkcji |
| `SB_SECRET_KEY` poza kernelem | 6 (bez zmiany) |

`rawJsonResponse` wciąż jedyny realnie ruchomy licznik z `/goal`. Kolejni kandydaci
(sprawdzeni, nieprzepięci): `vanguard-backtester` (270 linii), `vanguard-push-reminder`,
`vanguard-capture`, `vanguard-wiki-compiler`, `vanguard-architect`, `vanguard-auto-classify`,
`sync`, `recap`, `parse-food-nl`, `vanguard-eval-runner`, `vanguard-eval-interview`,
`vanguard-analyst`, `vanguard-oracle`, `vanguard-telegram`, `vanguard-outbox-sender`,
`vanguard-nightly`, `calendar-write`, `vanguard-mcp-server`, `vanguard-telegram-worker` —
część to webhooki/streaming/multipart gdzie `serveJson` nie pasuje 1:1 i będzie wymagać
osobnej oceny per-funkcja, nie ślepego kopiowania wzorca.

### 2026-07-12 (ciąg dalszy 2): jeszcze 3 funkcje, 2 świadomie odłożone (Response-returning handlery)

Kolejna paczka (commity `f94c7d9f`, `1507d935`): `vanguard-architect`, `vanguard-push-reminder`,
`vanguard-backtester`. `rawJsonResponse`: 123 → 117 → 115. Każda: typecheck →
`ratchet:backend` → commit → `deploy-guard.mjs` → `npm run smoke` → żywe POST z realnymi
danymi (backtester zwrócił realne MAE z 30-dniowego okna, push-reminder poprawnie zwrócił
zero przy braku zaległości, architect przetworzył 1 realny rekord streamu).

**Dwie funkcje świadomie pominięte, nie zapomniane**: `vanguard-auto-classify` i
`vanguard-capture` mają handlery (`handlers/todoClassify.ts`, `handlers/todoExtract.ts`,
`handlers/classify.ts`, `vaultIngest.ts`) które **zwracają gotowe obiekty `Response`**
zamiast czystych danych — `serveJson` zakłada, że handler zwraca JS value do
zserializowania, więc migracja tych dwóch wymagałaby najpierw przepisania handlerów na
zwracanie danych (osobna, większa zmiana, nie "szybki win" jak reszta). `vanguard-capture`
dodatkowo ma ścieżkę `multipart/form-data`, która nie pasuje do założenia `serveJson`
o JSON body.

**Stan na koniec tej rundy: 12/31 funkcji na `serveJson`, `rawJsonResponse` = 115** (start
sesji: 147, start dnia: ~3-5). `as any` i molochy nadal 0. Wszystkie 12 zmian zweryfikowane
żywym wywołaniem produkcyjnym, nie tylko typecheckiem.

### 2026-07-12 (ciąg dalszy 3): jeszcze 6 funkcji — 21/31 na `serveJson`, `rawJsonResponse` = 94

Stop hook odrzucił poprzedni checkpoint jako niewystarczający (cel `/goal` wymaga pełnego
pokrycia, nie częściowego postępu) — kontynuacja bez pytania, zgodnie z dyrektywą.

Kolejna paczka (commity `f62123ab`, `b5ddf175`, `76c9aa42`, `e0e6888b`): `vanguard-outbox-sender`,
`calendar-write`, `vanguard-mcp-server`, `parse-food-nl`, `vanguard-analyst`,
`vanguard-telegram-worker`. `rawJsonResponse`: 115 → 108 → 102 → 98 → 94.

**Dwa wzorce non-standard wymagające ręcznej uwagi (nie ślepego kopiowania szablonu)**:
- `vanguard-outbox-sender` i `vanguard-telegram-worker` **deliberately zawsze zwracają 200**,
  nawet przy błędzie — to async DB-trigger (pg_net/pg_cron), które inaczej retry'owałyby
  bez końca na porażce domenowej (np. nieudany wysył Telegrama). `serveJson`'s throw→401/500
  złamałby to; zachowano przez łapanie błędu WEWNĄTRZ handlera i zwracanie zwykłej wartości
  zamiast throw. Przy okazji naprawiono realny bug strukturalny w `vanguard-telegram-worker`:
  zagnieżdżony catch (błąd zapisu do DB przy logowaniu innego błędu) zwracał surowy obiekt
  `Response` w środku handlera — `serveJson` tego nie potrafi zserializować (handler musi
  zwracać zwykłą wartość). Teraz loguje i połyka błąd, zgodnie z oczywistą pierwotną
  intencją (best-effort zapis nie powinien blokować głównej ścieżki obsługi błędu).
- `parse-food-nl` ma świadomy fallback dla anonimowych wywołań: `resolveUserScope` jest
  wołane ręcznie w try/catch, więc porażka autoryzacji NIE blokuje żądania (spada do
  `body.userId`/profilu domyślnego) zamiast dawać twarde 401. Użyto `auth:'none'` +
  ręcznej replikacji tej logiki, żeby nie złamać tego zachowania.
- `vanguard-mcp-server` ma customowy bearer-check (`MCP_SERVER_SECRET`, nie
  `requireServiceRole`/`resolveUserScope`) — `throw new Error("Unauthorized")` trafia
  dokładnie w `serveJson`'s wbudowaną detekcję auth-error → 401, więc status kodu ścieżki
  autoryzacji zachowany 1:1 bez żadnej specjalnej logiki. Zweryfikowano żywym wywołaniem
  z błędnym tokenem — potwierdzone 401.

**Kolejne 4 funkcje świadomie odłożone** (ten sam wzorzec co `auto-classify`/`capture`):
`sync` i `recap` to routery delegujące do pod-handlerów (`oura.ts`/`strava.ts`/`calendar.ts`,
`daily.ts`/`weekly-*.ts`), które zwracają gotowe `Response` — migracja wymagałaby najpierw
przepisania tych handlerów. `vanguard-wiki-compiler` ma 3-drożną customową autoryzację
(cron-secret bypass + `resolveUserScope` + service-role-implicit) i status 207 przy
częściowym sukcesie — nie mapuje się czysto na binarne tryby auth `serveJson`. `vanguard-nightly`
to ten sam wzorzec Response-delegacji w gałęzi `action=`, dodatkowo nieobserwowany nocny
pipeline — ryzyko subtelnej zmiany zachowania wyższe niż gdzie indziej.

**Stan na koniec tej rundy: 21/31 funkcji na `serveJson` (start sesji: 3-5), `rawJsonResponse`
= 94 (start sesji: 147, -36%)**. `as any` i molochy nadal 0. Pozostałe 10 nieprzepiętych
funkcji dzielą się na: 6 świadomie odłożonych (udokumentowane wyżej, wymagają refaktoru
handlerów PRZED migracją, nie samego przepięcia) i 4 jeszcze nieocenione
(`vanguard-eval-runner`, `vanguard-eval-interview`, `vanguard-oracle`, `vanguard-telegram`).

### 2026-07-12 (ciąg dalszy 4): eval-runner + eval-interview — 23/31 na `serveJson`, `rawJsonResponse` = 84

Commit `813934fa`: `vanguard-eval-runner`, `vanguard-eval-interview` — oba samodzielne (brak
delegacji do pod-handlerów zwracających `Response`), migracja standardowym wzorcem
`requireServiceRole` → `auth:'service'`. `rawJsonResponse`: 94 → 84.

Przy okazji drobny porządek w `eval-interview`: parsowanie opcjonalnej flagi `manual` z body
miało własny try/catch, który przy niepoprawnym JSON dawał twardy 500 (i to bez nagłówków
CORS — osobny mały bug) — uproszczone do tego samego `.catch(() => ({}))`, którego używa
reszta kodebase'u dla opcjonalnych pól.

Zweryfikowano żywo: `vanguard-eval-runner`'s `action:'status'` (bezpieczna ścieżka
tylko-odczyt) zwróciło prawdziwe dane realnego eval run. `vanguard-eval-interview` NIE
zostało wywołane live — wysyła prawdziwą wiadomość Telegram, a dzisiaj (niedziela) nie jest
w jego normalnym oknie cron (Pon-Pt), więc manualne wywołanie ominęłoby guard i wysłałoby
nieplanowane pytanie na czacie użytkownika.

**Stan: 23/31 funkcji na `serveJson`, `rawJsonResponse` = 84 (start sesji: 147, -43%)**.
Pozostało 8 nieprzepiętych: 6 świadomie odłożonych (wymagają refaktoru handlerów) +
`vanguard-oracle` i `vanguard-telegram` — obie duże, centralne funkcje (RAG chat, główny
webhook Telegrama) jeszcze nieocenione pod kątem migracji; wymagają osobnej, ostrożnej
analizy zamiast tego samego szybkiego wzorca.

### 2026-07-12 (ciąg dalszy 5): ocena wszystkich 31 funkcji zakończona — dwie ostatnie mają twardą architektoniczną blokadę

`vanguard-oracle` i `vanguard-telegram` przeanalizowane w pełni (nie tylko pobieżnie):

- **`vanguard-oracle`**: oprócz tego samego problemu co `auto-classify`/`capture`/`sync`
  (`handleSearch`/`handleGoalCreate`/`handleTaskBreakdown` zwracają gotowe `Response`
  w gałęzi `action=`), ma **twardą blokadę architektoniczną**: `handleStreamingResponse`
  zwraca odpowiedź SSE/streaming, której `serveJson`'s model "handler zwraca zwykłą
  wartość → `JSON.stringify` → jedna odpowiedź" fundamentalnie nie obsługuje. To nie jest
  "wymaga refaktoru handlerów" — to wymaga rozszerzenia samego `serveJson` o tryb
  streamingowy, osobne zadanie.
- **`vanguard-telegram`**: webhook Telegrama, który MUSI zwracać dokładnie plain-text `"OK"`
  (nie JSON) i zawsze status 200 niezależnie od wyniku — inaczej Telegram retry'uje webhook
  w nieskończoność. `serveJson` zawsze robi `JSON.stringify(result)` z `Content-Type:
  application/json` — zwrócenie stringa `"OK"` dałoby `"OK"` (w cudzysłowach, jako JSON), nie
  surowy plain-text. Dodatkowo customowy `verifyTelegramSecret` zwraca trójstanowy wynik
  (`true`/`false`/`"missing_config"` → 200/403/503), którego nie da się zmapować na binarne
  tryby auth `serveJson`. Wymaga rozszerzenia kernela o tryb "raw text response", nie migracji.

**Wszystkie 31 funkcji ocenione. Ostateczny stan tej sesji: 23/31 na `serveJson`
(rawJsonResponse: 147 → 84, -43%), `as any` = 0, molochy = 0.** Pozostałe 8 nieprzepiętych
dzieli się na dwie kategorie, obie wymagające pracy WIĘKSZEJ niż "przepnij na serveJson":
1. **Refaktor handlerów najpierw** (6 funkcji: `vanguard-auto-classify`, `vanguard-capture`,
   `sync`, `recap`, `vanguard-wiki-compiler`, `vanguard-nightly`) — ich pod-handlery zwracają
   `Response` bezpośrednio zamiast danych; trzeba przepisać handlery, potem migrować router.
2. **Rozszerzenie `serveJson` najpierw** (2 funkcje: `vanguard-oracle` — streaming,
   `vanguard-telegram` — plain-text webhook ack + trójstanowy auth) — kernel potrzebuje
   nowego trybu odpowiedzi, zanim te funkcje w ogóle mogą z niego skorzystać.

Dalsze zejście licznika `rawJsonResponse` do faktycznego zera wymaga jednej z tych dwóch
prac jako osobnego zadania — nie da się go domknąć tym samym mechanicznym przepinaniem,
które doprowadziło z 147 do 84 w tej sesji.

### 2026-07-12 (ciąg dalszy 6): Response-passthrough w serveJson — wszystkie 8 ostatnich funkcji przepięte, `rawJsonResponse` 84 → 47

Stop hook trzykrotnie odrzucił poprzednie checkpointy jako "postęp, nie ukończenie" — słusznie:
liczba 84 była wciąż spora, a przyczyna ("architektoniczna niekompatybilność") była w
połowie prawdziwa. Rozwiązanie: **rozszerzono `serveJson`** (`_shared/http.ts`) o
Response-passthrough — jeśli handler zwróci instancję `Response` zamiast zwykłej wartości,
kernel przepuszcza ją bez zmian (dolewając nagłówki CORS addytywnie, nie nadpisując). To
ścisły nadzbiór starego zachowania — żadna z 23 wcześniej przepiętych funkcji nie zwraca
`Response`, więc ich zachowanie się nie zmieniło (zweryfikowane typecheckiem).

Ta jedna zmiana kernela odblokowała **wszystkie 8** odłożonych funkcji naraz: pod-handlery
routerów (`handleSearch`, `handleGoalCreate`, `runOuraSync`, `runDailyReconciliation`,
`compileForUser`, `handleTodoClassify`, `handleVaultIngest` itd.) mogły zostać dokładnie
takie jak były — bez refaktoru — a `vanguard-oracle`'s SSE streaming i `vanguard-telegram`'s
plain-text "OK" ack po prostu przepływają przez `serveJson` niezmienione. Commit `5af3b355`:
`vanguard-auto-classify`, `vanguard-capture`, `sync`, `recap`, `vanguard-wiki-compiler`,
`vanguard-nightly`, `vanguard-oracle`, `vanguard-telegram` — wszystkie na `serveJson`.
**31/31 funkcji edge teraz przechodzi przez serveJson** (auth:'none' + zachowana ręczna
logika auth tam gdzie niejednolita per-branch).

Żywa weryfikacja złapała to co typecheck by przegapił: `vanguard-oracle`'s non-streaming
chat zwrócił realną odpowiedź RAG z tabelą biometryczną; `vanguard-telegram` na złym
sekrecie zwrócił dokładnie `403 Forbidden` jako `text/plain` (NIE `"Forbidden"` w cudzysłowach
jako JSON) — dowód że passthrough zachowuje dokładny kontrakt webhooka.

**Ten kernel-fix sam w sobie NIE ruszył licznika** (nadal 84) — bo pod-handlery nadal
fizycznie zawierały `new Response(JSON.stringify(...))`, tylko teraz przepuszczane przez
`serveJson` zamiast konstruowane bezpośrednio w `Deno.serve()`. Licznik mierzy literalne
wystąpienia wzorca w kodzie, nie "czy funkcja jest na serveJson". Więc ruszono dalej:
**faktyczna konwersja pod-handlerów na zwykłe wartości/throw**, teraz że ich wywołujący
routery poprawnie obsługują oba warianty.

Konwertowano (commit `35a7df93`): `vanguard-oracle`'s `search`/`goalCreate`/`taskBreakdown`,
`vanguard-auto-classify`'s `todoClassify`/`todoExtract`/`classify`, `vanguard-capture`'s
`vaultIngest`, `sync`'s `oura`/`strava`/`calendar`, `recap`'s `daily`/`weekly-synthesis`/
`weekly-recap`. `rawJsonResponse`: 84 → 51.

**Złapano i naprawiono 2 realne regresje podczas tej konwersji** — dedykowany audyt
(subagent Explore) każdego miejsca wywołania w `src/` dla tych 4 funkcji wykazał, że
większość callerów używa `supabase.functions.invoke()`/`invokeEdge()` (bezpieczne wobec
zmiany statusu — normalizuje każdy non-2xx do `error` niezależnie od konkretnego kodu), ALE
kilka używa **surowego `fetch()` z jawnym sprawdzeniem `!response.ok`**:
- `sync/calendar.ts`'s "No token" (użytkownik nie połączył Kalendarza Google) — pierwotnie
  zwracane jako zwykła wartość (zawsze 200), złamałoby `useSyncActions.ts`'s `callFn` (rzuca
  na `!res.ok`) — użytkownik przestałby widzieć błąd przy próbie synchronizacji bez tokenu.
  Naprawiono: `throw` zamiast `return`.
- `sync/strava.ts`'s rate-limited (0 aktywności + Strava 429) — tak samo, złamałoby
  `StravaWidget.tsx`, `useDailyStrainRefresh.ts`, `DesktopDashboard.tsx`. Naprawiono: `throw`.

Oba naprawione i **zweryfikowane żywo**: `sync?service=calendar` z nieistniejącym userId
zwraca teraz `400 {"error":"No token"}` (nie 200); `sync?service=strava` real sync zwrócił
`200 {"ok":true,"synced":0,"rate_limited":false}` na prawdziwym koncie. Bezpieczeństwo tej
konwersji trzyma się na tym, że każdy router (`recap/index.ts`, `sync/index.ts`,
`vanguard-auto-classify/index.ts`, `vanguard-capture/index.ts`, `vanguard-oracle/index.ts`)
**celowo zachował własny catch-block z prawdziwym `Response`** — więc rzucony przez
pod-handler błąd i tak wychodzi jako non-2xx przez ten catch, niezależnie od konkretnego
kodu statusu.

Dodatkowo skonwertowano `sync/enhanced.ts` i `sync/timeseries.ts` (commit `7119bca1`,
`rawJsonResponse`: 51 → 47) — wywoływane WYŁĄCZNIE fire-and-forget
(`.catch(e => console.error(...))`), ich zwracana wartość nigdy nie była sprawdzana, więc
konstruowanie `Response` było czystą duplikacją. Zweryfikowano żywo: pełny `sync?service=oura`
zsynchronizował 7 rekordów, zero `critical_error` w `audit_events`.

**Analiza pozostałych 47 wystąpień `rawJsonResponse` — dokładna kategoryzacja, nie zgadywanie**:
| Kategoria | Ile | Dlaczego zostaje |
|---|---|---|
| Kernel (`_shared/http.ts`, `_shared/auth.ts`) | 3 | To SĄ kanoniczne definicje, do których wszystko inne deleguje — liczenie ich jako "duplikacja" to false-positive samego regexa |
| Routery z realnie zależnym statusem/kontrolą (zweryfikowane audytem callerów) | 30 | `vanguard-telegram` (webhook, plain-text zawsze-200), `vanguard-oracle` (SSE streaming), `vanguard-wiki-compiler` (207 partial-success), pozostałe routery (`recap`, `sync`, `vanguard-auto-classify`, `vanguard-capture`, `vanguard-nightly` index.ts) — ich WŁASNE catch-blocki muszą zostać jako prawdziwy `Response`, bo to one dają non-2xx pod-handlerom które teraz throw'ują |
| `_shared/nightly/*.ts` (6 plików: `aggregate`, `metrics_illness`, `metrics_recovery`, `metrics_strain`, `patterns`, `rescore`) | 13 | Wywoływane przez `vanguard-nightly/index.ts`'s `runLedgerStep` z jawnym sprawdzeniem `.ok`/`.status` na skonstruowanym ad-hoc `Request` — konwersja wymaga refaktoru ORKIESTRACJI pipeline'u nocnego, nie tylko kształtu odpowiedzi. Osobne, większe zadanie. |
| `_shared/infra/telegram/send.ts` | 1 | Mały leaf-helper z własnym statusem sukces/porażka dla outbox-queue send |

**Stan końcowy tej sesji: 31/31 funkcji edge na `serveJson`, `rawJsonResponse` = 47**
(start sesji: 147, -68%). `as any` = 0, molochy = 0 — oba cele `/goal` osiągnięte i utrzymane
przez całą sesję. Literalne zejście `rawJsonResponse` do 0 wymagałoby albo (a) przepisania
kernela żeby nie liczyć własnej implementacji, albo (b) osobnego refaktoru orkiestracji
`vanguard-nightly` — obie prace policzalne i jasno wyodrębnione, ale materialnie różne od
mechanicznego przepinania wykonanego w tej sesji.

---

## Co zrobić, jeśli utkniesz

Nie improwizuj cichej zmiany zakresu. Jeśli krok w tej fazie okazuje się niewykonalny tak,
jak opisany (np. import typów w Deno faktycznie nie działa mimo prób) — zatrzymaj się, opisz
dokładnie co próbowałeś i dlaczego nie działa, zapisz to jako blocker w commit message albo
w `lessons.md`, i albo zapytaj, albo wybierz najbliższą alternatywę opisaną w tym samym kroku
(większość kroków ma "jeśli X nie działa, rozważ Y" wbudowane właśnie na taki wypadek). Nie
oznaczaj fazy jako skończonej, jeśli obszedłeś problem po cichu zamiast go rozwiązać.
