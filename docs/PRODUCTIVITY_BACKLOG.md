# Vanguard OS — Rozszerzony Backlog Funkcjonalny

---

## 📌 Zebrane myśli 2026-07-03

**Strategia:** To już maraton, nie sprint. Vanguard 2.0 jest kompletny w swoim obecnym podmiocie. Dalszy rozwój = zbieranie pomysłów przez dni/tygodnie, bez atakowania kodu od razu po każdym pomyśle.

### Priorytety zidentyfikowane przez Jakuba:

**1. Tygodniowy widok jako mapa (Najważniejsze)**
- Nie lista eventów, ale interaktywna siatka całego tygodnia
- Bloki przesuwalne, edytowalne w miejscu
- Zsynchronizowane z Google Cal (zapis w obie strony)
- "Muszę widzieć cały tydzień i móc go rzeźbić"

**2. Budżety sfer tygodnia (Bardzo Ważne)**
- Min/max godzin per sfera: Praca, Siłownia/Trening, Relacje/Życie społeczne, Odpoczynek, Projekty hobbystyczne, Życie zawodowe
- "Czy ten tydzień był ważny?" = czy każda sfera dostała swoje minimum
- Planowanie tygodnia PRZED nim, a nie opisywanie po
- *Powiązane z istniejącym S-Tier: "Hexagonal Life Architecture"*

**3. Automatyczne przypomnienia życiowe**
- Polisa auta, przegląd techniczny → jednorazowe, cykliczne
- Urodziny (integracja z kontaktami?)
- Randki, spotkania społeczne
- Cykliczne zadania administracyjne

**4. Matryca kontekstowa ("co teraz najlepiej zrobić?")**
- Na podstawie: pory dnia, energii, dostępnego czasu
- Nie AI-decyduje, ale filtruje i sortuje zadania pod kontekst
- *Powiązane z istniejącym S-Tier: "Circadian Peak Scheduling"*

---

Dokument zawiera kompletny, nieprzefiltrowany zbiór mechanik i funkcji zebranych ze wszystkich analizowanych aplikacji, uporządkowany strukturalnie według Tierów (od S do C).

Złota zasada wdrożeń: **Najcenniejsze funkcje to te, które zwiększają wartość wielu istniejących modułów jednocześnie (np. łączą planowanie, refleksję, analitykę i integracje).**

---

## 🏆 S Tier (Core Engine / Główny Silnik)

Mechaniki będące rdzeniem funkcjonowania systemu osobistego jako aktywnego zarządcy czasem, uwagą i energią.

### ★ Vanguard Special: Wizualny Kreator Balansu i Architektura Tygodnia (Hexagonal Life Architecture)
*   **Wielowymiarowy "Heksagon Energii" (Visual Balance Planner):**
    *   *Opis:* Przed rozpoczęciem tygodnia użytkownik nie planuje sztywnego kalendarza godzinowego, ale "rzeźbi" swój tydzień. Ustala budżety czasowe/proporcje energii dla najważniejszych sfer życia (Praca, Ciało/Trening, Duch/Refleksja, Finanse, Relacje/Rodzina, Odpoczynek/Regeneracja) za pomocą interaktywnego wielokąta (np. heksagonu / radaru).
    *   *Zastosowanie:* Użytkownik widzi wizualną bryłę tygodnia (np. wydłużona w stronę "Praca" przy ciężkim sprincie, rozszerzona w stronę "Odpoczynek/Ciało" w tygodniu regeneracyjnym).
    *   *Integracja z zadaniami:* Pod heksagonem znajdują się "kafelki" najważniejszych zadań (priority tasks) na dany tydzień. Użytkownik przeciąga kafelki zadań bezpośrednio do odpowiednich sfer heksagonu, co automatycznie przypisuje je do danej kategorii i odejmuje czas z zaplanowanego budżetu danej sfery.
    *   *Widok z lotu ptaka:* Porównanie ramię w ramię obecnego tygodnia z poprzednim i kolejnym w celu oceny balansu życiowego na przestrzeni czasu.

### 1. Planowanie i Przepływ Zadań (Sunsama / Motion / Reclaim / Rise Science)
*   **Rollover Counter:** Licznik pokazujący, ile razy zadanie z datą wsteczną przeszło na kolejny dzień.
*   **Rollover Warning:** Ostrzeganie o zadaniach przekraczających limit przełożeń (np. $\ge 3$) w celu zapobiegania prokrastynacji.
*   **Pruning Flow (Aktywne czyszczenie):** Interaktywna decyzja rano/wieczorem na Telegramie o starych zadaniach (MIT na jutro / powrót do backlogu do sekcji *Someday* / usunięcie jako *dropped*).
*   **Time Estimation:** Przypisywanie do zadań szacowanego czasu trwania (np. `estimated_duration`).
*   **Capacity Planning (Dzienny Budżet):** Sumowanie szacowanego czasu zadań w `daily_wins`. Blokowanie lub ostrzeganie przed przeładowaniem dnia.
*   **Task History (Log aktywności):** Pełny zapis cyklu życia zadania (utworzenie, zmiany priorytetu, przełożenia) jako kontekst dla Oracle.
*   **Objectives Roll-forward:** Automatyczne przepychanie celów tygodniowych na kolejny tydzień podczas niedzielnego podsumowania.
*   **Time-horizon Backlog:** Podział backlogu na koszyki czasowe ("Na ten tydzień", "Na ten miesiąc", "Someday") zamiast jednej płaskiej listy.
*   **Focus Mode:** Dedykowany, czysty ekran na React UI wyświetlający tylko jedno zadanie z dużym timerem.
*   **AI Scheduling & Auto Rescheduling (Motion style):** Automatyczne dopasowanie czasu na zadania w kalendarzu i ich przetasowanie w locie w przypadku konfliktu.
*   **Deadline-first Scheduling:** Planowanie bloków czasu na zadania w kalendarzu tak, by priorytetowo zabezpieczyć wykonanie przed terminem ostatecznym.
*   **Workload Analysis:** Heatmapa obciążenia pracą w widoku kalendarza.
*   **Focus Time Defense:** Rezerwowanie w kalendarzu bloków na pracę głęboką i automatyczna odmowa spotkań.
*   **Circadian Peak Scheduling (Rise Science style):** Wyliczanie krzywej energii dobowej na podstawie snu Oura (okno bezwładności sennej, szczyt poranny, spadek popołudniowy, szczyt wieczorny) i automatyczne sugerowanie bloków na trudne zadania (*High Focus*) wyłącznie w oknach szczytowych.

### 2. Prowadzenie i Telemetria (RoutineFlow / Super Productivity / Rize.io)
*   **Interactive Telegram Routines:** Wykonywanie rutyn krok po kroku na Telegramie (bot wysyła jeden krok z przyciskami inline `[Zrobione]` / `[Pomiń]`).
*   **Step Timestamping:** Zapisywanie czasów rozpoczęcia i zakończenia każdego mikrokroku rutyny w bazie danych.
*   **Routine Bottleneck Analytics:** Porównywanie czasów szacowanych z rzeczywistymi w celu wykrywania kroków generujących tarcie.
*   **Adaptable Routines:** Warianty rutyn dopasowane do poziomu energii użytkownika.
*   **Zero-touch Focus Quality Tracker (Rize style):** Integracja z demonem systemowym monitorującym aktywne procesy/karty na desktopie i wyliczającym "Focus Score" na podstawie częstotliwości przełączania kontekstu.

### 3. Nawyki Ilościowe i Analiza (TickTick / Exist / Way of Life)
*   **Quantitative Habits:** Logowanie wartości liczbowych dla nawyków (np. woda w ml, medytacja w minutach).
*   **Correlation Engine (Exist style):** Automatyczna analiza statystyczna korelacji między nawykami ilościowymi (definiowanymi dynamicznie przez użytkownika) a biometrią (Oura, Strava) i nastrojem.
*   **Habit Heatmaps:** Prezentacja konsekwencji nawyków w formie siatki aktywności (GitHub-style).
*   **Yes/No/Skip Status (Way of Life):** Możliwość oznaczenia nawyku jako "Pominięty" (np. z powodu podróży), co nie zrywa serii (streaku) konsekwencji.

### 4. Pamięć Cyfrowa i Integracja Wiedzy (Logseq / Fabric / MyMind)
*   **Daily Notes Journaling:** Liniowe zapisywanie myśli w strumieniu jako wejście do bazy wiedzy.
*   **Semantic Search of Everything (Fabric):** Wyszukiwanie wektorowe przeszukujące notatki, linki i zadania w bazie za pomocą języka naturalnego.
*   **AI Auto-tagging (MyMind):** Automatyczne analizowanie linków i tekstów przez LLM i przypisywanie do nich tagów bez udziału użytkownika.

---

## 🥈 A Tier (Wysoka Wygoda i Ergonomia)

Funkcje poprawiające UX, organizację i szybkość działania systemu.

### 1. Kategoryzacja i Filtrowanie (TickTick / Tana)
*   **Eisenhower Matrix:** Widok 2x2 w UI grupujący zadania według ważności i pilności z drag-and-drop.
*   **Smart Filters:** Możliwość tworzenia i zapisywania własnych kryteriów filtrowania zadań w UI.
*   **Subtask Checklists & Task Templates:** Listy kontrolne wewnątrz zadań oraz gotowe szablony checklist do wielokrotnego wykorzystania.
*   **Nested Tags:** Hierarchiczne grupowanie tagów (np. `#finanse/faktury`).
*   **Supertags (Tana style):** Przypisywanie schematów pól do tagów w notatkach (np. tag `#książka` automatycznie generuje pola autor, ocena, status).

### 2. Kalendarze i Czas (Sunsama / Reclaim)
*   **Internal Calendar & Daily Timeline:** Rezerwacja czasu w kalendarzu wewnątrz Vanguard OS.
*   **Daily Summary Digest:** Podsumowanie dnia wysyłane na maila po zamknięciu pracy.
*   **Smart Buffers:** Automatyczne bufory po spotkaniach online (Decompression Time) i przed spotkaniami fizycznymi (Travel Time).

### 3. Śledzenie Stanu, Finansów i Zdrowia (Whoop / Gentler Streak / PocketGuard)
*   **Strain vs. Recovery Window (Whoop/Gentler Streak):** Rekomendowany przedział wysiłku na podstawie HRV, tętna i obciążenia, zapobiegający przetrenowaniu.
*   **Sleep Debt Tracker:** Wyliczanie długu sennego skumulowanego w ciągu tygodnia.
*   **RPE Workout Logging:** Rejestrowanie subiektywnej oceny wysiłku (Rate of Perceived Exertion) po treningu w celu kalibracji zmęczenia.
*   **Safe-to-Spend "In My Pocket" Calculator (PocketGuard style):** Dynamiczne liczenie dostępnych wolnych środków na dany dzień na podstawie przychodów, stałych rachunków i celów oszczędnościowych.

### 4. Resurfacing i Dziennik (Readwise / Day One)
*   **Spaced Repetition Daily Review:** Codzienne przypominanie 5 losowych fragmentów/notatek z przeczytanych książek lub artykułów.
*   **Flashbacks / On This Day:** Przypominanie wpisów z pamięci cyfrowej z ubiegłych lat.
*   **Multimedia Journaling:** Łączenie tekstu ze zdjęciami i lokalizacją na osi czasu.

---

## 🥉 B Tier (Rozbudowa zaawansowana)

Funkcje o dużym stopniu skomplikowania wdrożenia lub mniejszym codziennym wpływie na system.

*   **Pomodoro Logs & Floating Focus Widget:** Rejestrowanie sesji pracy głębokiej bezpośrednio powiązanych z zadaniami oraz pływające okienko timera w React UI.
*   **Inbox Webhooks & Email-to-Task Parser:** Automatyczne konwertowanie maili na zadania w kolejce za pomocą parsera LLM.
*   **Routine Triggers & iOS Shortcuts:** Automatyczne sugerowanie startu rutyny po zdarzeniu (np. treningu) oraz sterowanie głosowe przez skróty iOS.
*   **Task Splitting:** Dzielenie dużych zadań na mniejsze bloki w kalendarzu.
*   **Beeminder Commitment Logic:** Mechanika nakładania na siebie kar/zobowiązań (w tym ostrzeżeń) za niedotrzymanie celów.
*   **Knowledge Graph Visualizer (Obsidian style):** Interaktywna mapa sieci pojęć z Twojego Memexu.
*   **Envelope Budgeting (YNAB style):** Szybkie wprowadzanie wydatków na Telegramie (np. `/kup kawa 15`) i śledzenie stanu dynamicznych kopert budżetowych.
*   **Mood & Tag Correlation (Reflectly style):** Analiza wpływu konkretnych aktywności/tagów na codzienną ocenę nastroju.
*   **Supertags Fields Render:** Dynamiczne renderowanie formularzy w React UI na podstawie przypisanych tagów w notatce.

---

## 🗛 C Tier (Estetyka i Ulepszenia UX)

Elementy dźwiękowe, wizualne i drobne widgety.

*   **White Noise / Embedded Spotify / Floating Music Widget:** Odtwarzacze muzyki/szumów bezpośrednio w dashboardzie.
*   **Drobne animowane widgety:** Wizualne animacje postępu i liczników.
*   **Milanote Visual Boards:** Nieskończona tablica (canvas) do wizualnego planowania projektów na React UI.
