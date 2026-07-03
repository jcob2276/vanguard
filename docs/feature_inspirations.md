# Vanguard OS — Bank Inspiracji Funkcjonalnych (Feature Inspirations)

Ten dokument zawiera analizę wiodących aplikacji w kategoriach produktywności, wiedzy (PKM), zdrowia, nawyków, refleksji oraz narzędzi nietypowych. Dla każdego programu wyselekcjonowano kluczowe mechaniki, oceniono ich dopasowanie do Vanguard OS, przypisano priorytet oraz szacowany koszt wdrożenia.

---

## 🧭 Kategoria 1: Produktywność i Planowanie

### 1. Motion
*   **AI Auto-scheduling**
    *   *Opis:* Automatyczne układanie otwartych zadań w kalendarzu w wolnych slotach czasowych.
    *   *Dlaczego dobre:* Eliminuje ręczny timeblocking.
    *   *Adaptacja do Vanguard:* Skrypt w edge function pobiera otwarte `todo_items` z `due_date` i dopasowuje je do wolnych przestrzeni w kalendarzu Google Calendar (synchronizowanym przez `sync-calendar`).
    *   *Priorytet:* A | *Trudność:* Wysoka (algorytm rozwiązywania konfliktów)
*   **Continuous Replanning**
    *   *Opis:* Przebudowa całego harmonogramu w locie przy dodaniu nowego spotkania.
    *   *Dlaczego dobre:* Zapobiega dezaktualizacji planu.
    *   *Adaptacja do Vanguard:* Webhook z kalendarza wykrywa nowe zdarzenie i natychmiast wyzwala relokację powiązanych zadań w bazie.
    *   *Priorytet:* B | *Trudność:* Wysoka
*   **Deadline-first Scheduling**
    *   *Opis:* Planowanie czasu na zadania tak, by zdążyć przed ostatecznym terminem.
    *   *Dlaczego dobre:* Chroni przed prokrastynacją ważnych projektów.
    *   *Adaptacja do Vanguard:* Sortowanie zadań po `due_date` i czasie trwania przed uruchomieniem algorytmu auto-schedulingu.
    *   *Priorytet:* A | *Trudność:* Średnia
*   **Workload Heatmap**
    *   *Opis:* Wizualne oznaczenie obciążenia (kolorami) na dany dzień na podstawie sumy godzin zaplanowanych zadań.
    *   *Dlaczego dobre:* Szybki feedback wizualny o przeładowaniu pracą.
    *   *Adaptacja do Vanguard:* Dodanie podsumowania czasowego w widoku `PowerList` / `Direction` w React UI.
    *   *Priorytet:* A | *Trudność:* Niska

### 2. Reclaim.ai
*   **Dynamic Habits**
    *   *Opis:* Rezerwowanie elastycznych okien na nawyki (np. 1h na czytanie w przedziale 18:00-22:00).
    *   *Dlaczego dobre:* Nawyki dopasowują się do zmieniającego się dnia.
    *   *Adaptacja do Vanguard:* Definicja reguł w nowej tabeli `habit_rules` i alokowanie czasu w kalendarzu.
    *   *Priorytet:* A | *Trudność:* Średnia
*   **Decompression Time**
    *   *Opis:* Automatyczne dodawanie np. 15-minutowych bloków odpoczynku po spotkaniach online.
    *   *Dlaczego dobre:* Zapobiega spotkaniom "back-to-back" i przeciążeniu.
    *   *Adaptacja do Vanguard:* `sync-calendar` automatycznie wstrzykuje krótki blok "Odpoczynek" po eventach oznaczonych jako wideokonferencje.
    *   *Priorytet:* B | *Trudność:* Średnia
*   **Travel Time**
    *   *Opis:* Blokowanie czasu na dojazd przed i po spotkaniach mających przypisaną lokalizację.
    *   *Dlaczego dobre:* Realistyczne podejście do logistyki dnia.
    *   *Adaptacja do Vanguard:* Parser kalendarza sprawdza pole `location` i dodaje bufor.
    *   *Priorytet:* C | *Trudność:* Średnia
*   **Focus Time Defense**
    *   *Opis:* Proaktywne rezerwowanie czasu na Deep Work i blokowanie prób zaproszeń.
    *   *Dlaczego dobre:* Zabezpiecza czas na najważniejszą pracę.
    *   *Adaptacja do Vanguard:* System wstawia w kalendarzu bloki "Focus" w godzinach porannych.
    *   *Priorytet:* B | *Trudność:* Niska

### 3. Sunsama
*   **Guided Daily Planning**
    *   *Opis:* Rytuał przeglądu wczorajszego dnia, kalendarza i planowania dzisiejszych zadań.
    *   *Dlaczego dobre:* Buduje nawyk intencjonalnego zaczynania dnia.
    *   *Adaptacja do Vanguard:* Ustrukturyzowany kreator planu dnia w React UI na zakładce "Dziś" (PowerList builder).
    *   *Priorytet:* A | *Trudność:* Niska
*   **Guided Daily Shutdown**
    *   *Opis:* Podsumowanie dnia, spisanie wniosków i zaplanowanie jutra przed zamknięciem komputera.
    *   *Dlaczego dobre:* Ułatwia mentalne odcięcie się od pracy.
    *   *Adaptacja do Vanguard:* Nasz wieczorny wywiad na Telegramie (`vanguard-daily-reconciliation`) rozszerzony o krok zamykający dzień.
    *   *Priorytet:* A | *Trudność:* Niska
*   **Rollover Decapitation**
    *   *Opis:* Przenoszenie odkładanych zadań do archiwum/backlogu po osiągnięciu progu przełożeń.
    *   *Dlaczego dobre:* Chroni przed poczuciem winy z powodu wiecznych "zaległych" zadań.
    *   *Adaptacja do Vanguard:* Dodanie licznika `rollover_count` do `todo_items`. Jeśli wynosi $\ge 3$, system usuwa `due_date` i wymusza ponowną decyzję w refleksji.
    *   *Priorytet:* S | *Trudność:* Niska

### 4. Amazing Marvin
*   **Energy Mode Toggles**
    *   *Opis:* Filtrowanie zadań według poziomu energii potrzebnej do ich wykonania (High/Low Energy).
    *   *Dlaczego dobre:* Pozwala na efektywną pracę w gorsze dni.
    *   *Adaptacja do Vanguard:* Dodanie tagów energii lub pola `energy_requirement` do zadań i filtrów w React UI.
    *   *Priorytet:* A | *Trudność:* Niska
*   **Procrastination Hacks (Tiny Steps)**
    *   *Opis:* Opcja "zrób ten krok przez 5 minut" zamiast całego zadania.
    *   *Dlaczego dobre:* Pomaga przełamać opór startowy.
    *   *Adaptacja do Vanguard:* Przycisk w UI "Rozbij na mikro-krok" wywołujący LLM do rozpisania zadania na 3 proste czynności.
    *   *Priorytet:* B | *Trudność:* Średnia
*   **Burnout Warning Radar**
    *   *Opis:* Wskaźnik ostrzegawczy na podstawie liczby dni bez przerw lub z nadgodzinami.
    *   *Dlaczego dobre:* Wczesne wykrywanie zmęczenia.
    *   *Adaptacja do Vanguard:* Edge function `vanguard-analyst` analizuje logi aktywności i biometrię, po czym wysyła ostrzeżenie.
    *   *Priorytet:* A | *Trudność:* Średnia

### 5. TickTick
*   **Eisenhower Matrix 2x2 Board**
    *   *Opis:* Tablica grupująca zadania na podstawie ważności i pilności.
    *   *Dlaczego dobre:* Intuicyjna organizacja priorytetów.
    *   *Adaptacja do Vanguard:* Widok React UI mapujący kombinację `priority` i `ai_bucket` na kwadranty.
    *   *Priorytet:* A | *Trudność:* Niska
*   **Quantitative Habit Tracking**
    *   *Opis:* Rejestrowanie nawyków z wartością liczbową (np. woda w ml).
    *   *Dlaczego dobre:* Lepsze dane analityczne niż zwykły checkbox.
    *   *Adaptacja do Vanguard:* Zapisywanie logów nawyków z polem `numeric_value` i korelacja w `vanguard-analyst`.
    *   *Priorytet:* S | *Trudność:* Średnia

### 6. Akiflow
*   **Universal Inbox Aggregator**
    *   *Opis:* Zbieranie powiadomień i zadań z różnych aplikacji w jedną skrzynkę odbiorczą.
    *   *Dlaczego dobre:* Jedno miejsce do porządkowania spraw.
    *   *Adaptacja do Vanguard:* Nasza tabela `telegram_inbox_queue` rozszerzona o maile i linki.
    *   *Priorytet:* B | *Trudność:* Średnia
*   **Keyboard-first command bar**
    *   *Opis:* Szybkie dodawanie i edycja zadań wyłącznie za pomocą skrótów klawiszowych.
    *   *Dlaczego dobre:* Minimalizuje tarcie podczas wprowadzania danych.
    *   *Adaptacja do Vanguard:* Wdrożenie globalnego Command Palette (`Ctrl+K`) w React UI.
    *   *Priorytet:* A | *Trudność:* Średnia

### 7. Morgen / SkedPal
*   **Unified Scheduling Links (Morgen)**
    *   *Opis:* Udostępnianie linków do rezerwacji spotkań zintegrowanych z Twoimi zablokowanymi godzinami pracy głębokiej.
    *   *Dlaczego dobre:* Chroni kalendarz przed przypadkowymi spotkaniami.
    *   *Adaptacja do Vanguard:* Niska przydatność w systemie w pełni osobistym (poza integracją z Google Calendar).
    *   *Priorytet:* C | *Trudność:* Średnia
*   **Scheduling Heuristics / Time Maps (SkedPal)**
    *   *Opis:* Planowanie zadań na podstawie ogólnych preferencji (np. "zadania kreatywne rano"), a nie dokładnych godzin.
    *   *Dlaczego dobre:* Elastyczne planowanie dostosowane do rytmu dobowego.
    *   *Adaptacja do Vanguard:* Mapowanie zadań na porę dnia (`task_N_time_slot`) w `daily_wins`.
    *   *Priorytet:* S (już częściowo wdrożone w bazie) | *Trudność:* Niska

### 8. RoutineFlow
*   **Telegram Sequential Routine Engine**
    *   *Opis:* Krok po kroku prowadzenie za rękę przez nawyk w Telegramie.
    *   *Dlaczego dobre:* Skupia uwagę na jednej rzeczy w danej chwili.
    *   *Adaptacja do Vanguard:* Nowy handler komendy `/rutyna` wysyłający kolejne kroki z przyciskami inline.
    *   *Priorytet:* S | *Trudność:* Średnia
*   **Routine Bottleneck Diagnostics**
    *   *Opis:* Analiza czasu trwania kroków w celu znalezienia opóźnień.
    *   *Dlaczego dobre:* Ujawnia realne tarcie w nawykach.
    *   *Adaptacja do Vanguard:* Logowanie czasów trwania w `routine_logs` i raporty w analityku tygodniowym.
    *   *Priorytet:* S | *Trudność:* Średnia

---

## 🗂️ Kategoria 2: PKM i Zarządzanie Wiedzą

### 9. Logseq / Obsidian
*   **Daily Notes Journaling (Logseq)**
    *   *Opis:* Każdy dzień zaczyna się od pustej notatki dziennej, w której zapisuje się wszystko.
    *   *Dlaczego dobre:* Brak tarcia przy szukaniu odpowiedniego folderu.
    *   *Adaptacja do Vanguard:* Nasz strumień `vanguard_stream` to dokładnie ta koncepcja. Zapisujesz myśli liniowo, a system je indeksuje.
    *   *Priorytet:* S (już wdrożone w bazie) | *Trudność:* Niska
*   **Interactive Knowledge Graph (Obsidian)**
    *   *Opis:* Wizualizacja połączeń między notatkami w postaci sieci węzłów.
    *   *Dlaczego dobre:* Pomaga dostrzec nieoczywiste powiązania i ułatwia nawigację.
    *   *Adaptacja do Vanguard:* Widok 3D/2D sieci pojęć na podstawie tabeli `vanguard_entity_links` w React UI.
    *   *Priorytet:* B | *Trudność:* Wysoka

### 10. Tana / Capacities
*   **Supertags / Object Schemas (Tana)**
    *   *Opis:* Nadawanie notatkom tagów, które automatycznie dodają zestaw pól strukturalnych (np. `#książka` dodaje pola Autor, Ocena, Status).
    *   *Dlaczego dobre:* Łączy strukturę bazy danych z elastycznością tekstu.
    *   *Adaptacja do Vanguard:* Typowanie notatek w `vanguard_notes` i automatyczne renderowanie odpowiednich kart (Memex Cards) w zależności od typu obiektu.
    *   *Priorytet:* A | *Trudność:* Średnia
*   **Object-based Knowledge Architecture (Capacities)**
    *   *Opis:* Klasyfikacja wiedzy na obiekty o określonych strukturach (Ludzie, Miejsca, Książki) zamiast płaskich dokumentów.
    *   *Dlaczego dobre:* Odzwierciedla to, jak myślimy o świecie.
    *   *Adaptacja do Vanguard:* Nasz system `entities/` (person, place, link) w React UI już teraz realizuje tę koncepcję.
    *   *Priorytet:* A (już częściowo wdrożone) | *Trudność:* Niska

---

## 📊 Kategoria 3: Zdrowie i Analiza Behawioralna

### 11. Exist.io
*   **Multi-source Correlation Engine**
    *   *Opis:* Automatyczne wykrywanie zależności między różnymi obszarami życia (np. sen vs. wypita kawa).
    *   *Dlaczego dobre:* Dostarcza obiektywnych wniosków na podstawie twardych danych.
    *   *Adaptacja do Vanguard:* Edge function `compute-correlations` zestawia dane z Oury, Stravy i logów nawyków w poszukiwaniu statystycznie istotnych korelacji.
    *   *Priorytet:* S | *Trudność:* Średnia
*   **Automatic Insights**
    *   *Opis:* Generowanie zdań w języku naturalnym o trendach (np. *"Kiedy biegasz dłużej niż 5km, Twój sen głęboki rośnie średnio o 20 min"*).
    *   *Dlaczego dobre:* Dane są łatwe do przyswojenia przez użytkownika.
    *   *Adaptacja do Vanguard:* AI generuje podsumowanie statystyk w raporcie tygodniowym.
    *   *Priorytet:* S | *Trudność:* Średnia

### 12. Gyroscope / Whoop / Athlytic
*   **Strain vs. Recovery Guidance (Whoop)**
    *   *Opis:* Rekomendowanie poziomu wysiłku na dany dzień w zależności od regeneracji.
    *   *Dlaczego dobre:* Zapobiega przetrenowaniu i wspiera regenerację.
    *   *Adaptacja do Vanguard:* Zestawienie obciążenia treningowego ze Stravy z danymi Oura w edge function `compute-daily-strain`.
    *   *Priorytet:* A (już częściowo wdrożone) | *Trudność:* Niska
*   **Health Dashboard Visualization (Gyroscope)**
    *   *Opis:* Piękne, futurystyczne wizualizacje danych biomedycznych.
    *   *Dlaczego dobre:* Zwiększa zaangażowanie użytkownika (tzw. "wow factor").
    *   *Adaptacja do Vanguard:* Nasza sekcja `MedicalBiologyScores` i wykresy trendów w React UI.
    *   *Priorytet:* A (już wdrożone) | *Trudność:* Niska

---

## 📈 Kategoria 4: Budowanie Nawyków, Dziennik i Wiedza

### 13. Streaks / Way of Life / Everyday
*   **Visual Consistency Heatmaps**
    *   *Opis:* Siatki konsekwencji nawyków ułatwiające utrzymanie ciągłości.
    *   *Dlaczego dobre:* Psychologiczna motywacja do utrzymania łańcucha (streaku).
    *   *Adaptacja do Vanguard:* Wdrożenie siatki nawyków w UI.
    *   *Priorytet:* A | *Trudność:* Niska
*   **Beeminder Commitment Logic**
    *   *Opis:* Finansowe kary za niedotrzymanie celów.
    *   *Dlaczego dobre:* Silny bodziec zewnętrzny.
    *   *Adaptacja do Vanguard:* Opcjonalny moduł "zakładu z samym sobą", gdzie system blokuje środki (lub wysyła powiadomienie do bliskiej osoby) w razie porażki.
    *   *Priorytet:* C | *Trudność:* Średnia

### 14. Day One / Diarium
*   **Multimedia Reflection timeline**
    *   *Opis:* Łączenie wpisów tekstowych ze zdjęciami, lokalizacją i muzyką z danego dnia.
    *   *Dlaczego dobre:* Tworzy bogaty zapis wspomnień.
    *   *Adaptacja do Vanguard:* Nasz strumień `vanguard_stream` z załącznikami z Telegrama prezentowany na osi czasu w UI.
    *   *Priorytet:* A | *Trudność:* Niska
*   **On This Day (Flashbacks)**
    *   *Opis:* Przypominanie wpisów sprzed roku, dwóch lub pięciu lat.
    *   *Dlaczego dobre:* Zwiększa wartość historyczną zgromadzonych danych.
    *   *Adaptacja do Vanguard:* Rano lub wieczorem bot Telegrama wysyła retrospektywę: *"Dokładnie rok temu pisałeś o..."*.
    *   *Priorytet:* B | *Trudność:* Niska

### 15. Readwise / Matter
*   **Daily Review / Spaced Repetition**
    *   *Opis:* Codzienny przegląd 5 losowych zakładek lub cytatów z przeczytanych książek.
    *   *Dlaczego dobre:* Zapobiega zapominaniu wiedzy z przeczytanych książek.
    *   *Adaptacja do Vanguard:* Wdrożenie tabeli `vanguard_wiki_review_items` (już istnieje w migracji `20260612123000`). System rano lub w wyznaczonym widoku wyświetla cytaty/notatki do powtórzenia.
    *   *Priorytet:* A | *Trudność:* Niska

---

## 🛠️ Kategoria 5: Nietypowe Źródła Inspiracji

### 16. Milanote / Fabric / MyMind
*   **AI Auto-tagging (MyMind)**
    *   *Opis:* Wrzucasz link, obrazek lub tekst, a AI automatycznie kategoryzuje go i dodaje tagi bez Twojego udziału.
    *   *Dlaczego dobre:* Zerowe tarcie przy zapisywaniu informacji.
    *   *Adaptacja do Vanguard:* Klasyfikator `vanguard-auto-classify` automatycznie przypisuje tagi do wpisów w strumieniu.
    *   *Priorytet:* S (już wdrożone) | *Trudność:* Niska
*   **Unified Search of Everything (Fabric)**
    *   *Opis:* Jeden pasek wyszukiwania, który przeszukuje Twoje pliki, notatki, linki i historię aktywności za pomocą wyszukiwania semantycznego (Vector Search).
    *   *Dlaczego dobre:* Nie musisz pamiętać, gdzie coś zapisałeś.
    *   *Adaptacja do Vanguard:* Wyszukiwanie semantyczne oparte na bazie wektorowej `pgvector` i embeddings w Supabase (funkcje wyszukiwania po grafie).
    *   *Priorytet:* S | *Trudność:* Średnia
