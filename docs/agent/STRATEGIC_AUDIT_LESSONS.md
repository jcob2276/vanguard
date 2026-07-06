# Strategic Audit — Notatka skonsolidowana (Lipiec 2026)

*Zsyntetyzowane z 4 rund audytu. Surowy zapis rund w historii gita tego pliku — poniżej wersja poukładana tematycznie, nie chronologicznie.*

## Meta-wzorzec: problem ostatniej mili

Najważniejsze znalezisko całego audytu. Vanguard nie ma braków w budowaniu — ma przerwane przewody na końcu. Siedem mechanizmów, wszystkie zbudowane, żaden domknięty:

| Mechanizm | Zbudowane | Brakuje |
|---|---|---|
| `e2e-daily-loop.mjs` (heartbeat) | Działa codziennie 08–09h | Failure nie dociera do Ciebie (tylko mail z GH Actions) |
| `knip` (audit martwego kodu) | Skonfigurowany w package.json | Nie wywołany w `ci.yml` |
| weekly digest | Liczy się | Nikt nie czyta |
| `dream_id` / goal-lineage | Kod istnieje | Zero wypełnionych danych |
| `eval-runner` | Istnieje | Nieużywany |
| skrót PWA "Dodaj zadanie" | Zadeklarowany | Martwy parametr |
| `vanguard_graph_cleanup()` | Funkcja istnieje w migracji | Cron zakomentowany — sprzątaczka nigdy nie wpuszczona |

**Diagnoza:** sesja z agentem kończy się, gdy rzecz "działa u siebie". Podpięcie konsumenta, wpięcie w CI, alert do człowieka — to osobna, nudna sesja, która nigdy nie nadchodzi.

**Nowa reguła robocza:** *Feature jest skończony, gdy jego wynik ktoś konsumuje — inaczej nie istnieje.*

**Rekomendacja:** zanim cokolwiek nowego — jedna sesja "ostatniej mili" przechodząca tabelę od góry. Najtańszy pakiet zysków w całym audycie: wszystko już napisane, brakuje po jednym kablu. (1–2 sesje)

---

## Znaleziska techniczne (Runda 1)

**CI ma częściowe oczy.** `e2e-daily-loop.mjs` to dojrzały heartbeat (8 asercji: strain → wiersz w bazie → aggregate → reconciliation → Telegram osiągalny), ale pokrywa tylko rdzeń — ~10 pozostałych cronów (sync-strava, patterns, correlations, nutrition-coach, push-reminder) może nadal gnić po cichu bez wykrycia. Fix: dodać alert "on failure → Telegram" (bot już istnieje) + rozszerzyć asercje na resztę cronów.

**Kolizja nazw "oracle".** `vanguard-oracle` (Q&A, 1257 linii) i `vanguard-architect/oracle/` (ekstrakcja wiedzy ze stream, 751 linii) — zero wspólnego kodu, ta sama nazwa. Naming to jedyna baza danych, jaką agent ma przed przeczytaniem kodu — kolizja gwarantuje pomyloną pracę przyszłych sesji. *(Status: przemianowano na `extraction/` — patrz git status, folder już nie istnieje pod starą nazwą.)*

---

## Strategiczne dźwignie (Runda 2 — odwrócone założenia)

**1. Backtest inteligencji na własnej historii.** 60+ dni kompletnej historii (sen, strain, plany, reconciliacje, jedzenie) to gotowy zestaw testowy dla mózgu. Nowy detektor wzorców / prompt / planer → przepuszczony przez każdy historyczny dzień → diff rad ("stary planer proponował X, nowy Y, rzeczywistość była Z"). Logika pipeline'u to już czyste funkcje w `_shared`, więc technicznie tanie. Skraca pętlę uczenia systemu z miesięcy do minut — największa pojedyncza dźwignia dla warstwy inteligencji. Daje też sens martwemu `eval-runner`. (2–3 sesje, po `world_state`)

**2. Vanguard jako MCP server.** Wystawić `world_state` + `search` + `daily_facts` jako serwer MCP, żeby dowolny agent (np. ta sesja) mógł zapytać o fakty zamiast o przybliżenia z pamięci — planowanie treningu, sesji dev pod recovery, itd. Dane już ustrukturyzowane, więc to 1–2 sesje po `world_state`.

**3. Metabolizm zamiast hoardingu.** Tylko 2 DELETE w całym backendzie — nic nigdy nie znika, a sprzątaczka (`vanguard_graph_cleanup()`) ma zakomentowany cron. Docelowy wzorzec: kwartalna kondensacja — surowe wiersze → narracja + beliefs → surowe do zimnego archiwum. Bez tego za kilka lat życie w setkach tysięcy wierszy, których żaden prompt nie udźwignie. Decyzja formatu ma zapaść teraz, bo `world_state` powinien ją przewidzieć — realizacja może poczekać do po-sierpnia.

**4. Epistemika w danych, nie w promptach.** Każda liczba na dashboardzie świeci z jednakową pewnością, nawet gdy Oura nie zsynchronizowała się od 2 dni. Konstytucja ma "epistemiczne guardraile", ale one żyją w promptach — powinny żyć w danych: każde pole `world_state` z metadanymi świeżości/kompletności/źródła. Efekt: UI wyszarza niepewne, Oracle mówi "nie mam wczorajszego snu, pomijam go" zamiast zmyślać pewnie. (1 sesja przy projektowaniu `world_state`, potem prawie darmowe)

**Bonusy zweryfikowane w kodzie:**
- Głos już działa w Telegramie (transkrypcja voice) — capture w biegu jest gotowy.
- Kalendarz jako wyjście istnieje (`calendar-write` + hook) — brakuje tylko, by nocny pipeline sam wystawiał bloki (regeneracja, deep work pod checkpoint). Scope-gates uchylone, więc to kwestia jednej rury, nie zgody.

**Ramowanie:** przestać myśleć o Vanguardzie jak o aplikacji z funkcjami — myśleć jak o instytucji z pamięcią: historia (backtest), dyplomacja (MCP), metabolizm (kondensacja), pokora (epistemika w danych). Wszystkie cztery stoją na `world_state`, który i tak jest następnym krokiem — nic nie zmienia kolejności robót, zmienia dokąd ta kolejność prowadzi.

---

## Runda 3 — przerwana, do powtórzenia

Cztery hipotezy zapowiedziane, ale przerwane przez rate-limit serwera — **nie traktować jako zweryfikowane**:
1. Czy metryki na dashboardzie pokazują zmianę (delta) czy tylko stan.
2. Czy stare beliefs/refleksje kiedykolwiek wracają (resurfacing) czy giną po zapisaniu.
3. Czy Telegram inicjuje kontakt rano sam z siebie (proactive) czy tylko odpowiada.
4. Co dokładnie liczy `MarathonPanel` i czy to zgadza się z rzeczywistą metodą (Cooper/VO2max).

Te cztery trzeba sprawdzić w kodzie od nowa w osobnej sesji.

---

## Kontekst rynkowy — Poke (Runda 4, aside)

Poke: komercyjny asystent-w-komunikatorze, 30+ integracji (w tym Oura), proaktywne automatyzacje, głos, $19–199/mies.

**Co warto ukraść:** interfejs = wyłącznie komunikator (Telegram-bot ma być docelowym frontem, nie dodatkiem; mobile UI = dashboard do przeglądania, nie wpisywania); "recipes" — automatyzacje jako konfigurowalne dane, nie kod.

**Czego Poke nigdy nie będzie miał (moat Vanguarda):** głębia n=1 (60 dni reconciliacji, adherence, beliefs z outcome'ami), domenowa kalibracja (maraton, 14% BF), pełna własność danych i kodu.

**Jedyna korekta strategiczna wynikająca z tego:** podnieść priorytet Telegrama jako pełnoprawnego interfejsu — dziś ~10 komend, docelowo powinien obsługiwać wszystko, co robi Oracle, plus proaktywny poranny brief (informacja, nie prewencja — zgodne z konstytucją). Kolejność prac się nie zmienia, tylko pewność co do kierunku.

---

## Priorytetyzacja (co robić w jakiej kolejności)

1. **Sesja "ostatniej mili"** — domknąć 7 przerwanych przewodów z tabeli u góry. Najtańsze, wszystko już napisane. (1–2 sesje)
2. **Dokończyć Rundę 3** — zweryfikować 4 przerwane hipotezy w kodzie.
3. **`world_state`** jako fundament — bo on determinuje kształt kondensacji, epistemiki i MCP-serwera. Wszystkie 3 duże dźwignie (backtest, MCP, metabolizm) czekają na niego.
4. Backtest / MCP / metabolizm / epistemika — po `world_state`, dowolna kolejność wg energii.
5. Rozbudowa Telegrama jako pełnego interfejsu — równolegle, niezależna ścieżka.
