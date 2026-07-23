# Active Work

## Priorytet: Vanguard — system interakcji inspirowany iOS

### Cel

Vanguard na Windows/PWA i Androidzie ma wyglądać i zachowywać się jak aplikacja
zaprojektowana zgodnie z zasadami Apple:
czytelna typografia systemowa, semantyczne materiały, cele dotykowe minimum 44 px,
natychmiastowy feedback, przerywalne sprężyny, gesty śledzące palec 1:1, natywna
haptyka i pełna obsługa ustawień dostępności.

### Zatwierdzony model

- `src/index.css` pozostaje jedynym źródłem tokenów wizualnych.
- `src/lib/motion/iosMotion.ts` jest jedynym źródłem parametrów fizyki i projekcji gestu.
- `ui/Button`, `ui/Modal` i `ui/Sheet` są kanonicznymi prymitywami.
- Wycofujemy język Pixel/neon z prymitywów na rzecz hierarchii iOS.
- PWA i Capacitor korzystają z tego samego UI; natywna haptyka działa przez
  Capacitor, a web ma bezpieczny fallback.
- Obsługiwane platformy to Windows/PWA i Android. Apple jest wzorcem projektowym,
  nie platformą docelową; projekt nie zawiera zależności ani katalogu iOS.

### Plan techniczny

1. Test-first: projekcja momentum, rubber-band i wybór snap point.
2. Centralne tokeny: Dynamic Type, cele 44 px, tracking, materiały i dostępność.
3. Button, Modal i Sheet: feedback, focus, inert, drag, velocity i snap points.
4. Nawigacja: fizyczny wskaźnik i swipe śledzący palec 1:1.
5. Haptyka: Capacitor za guardem platformy i web fallback.
6. Platforma: Android/Capacitor, status bar, safe areas i Windows/PWA.
7. Migracja konsumentów starych klas prymitywów.
8. Testy, typecheck, lint, ratchety, buildy i wizualna weryfikacja mobile.

### Bramy jakości

- Każda nowa funkcja zachowania zaczyna od testu, który najpierw nie przechodzi.
- Nowe pliki UI mają mniej niż 300 linii.
- Decyzje wizualne pozostają w `src/index.css`.
- Każdy prymityw dotykowy ma aktywny obszar minimum 44 × 44 px.
- Ruch dotykowy jest przerywalny; reduced motion zachowuje informację bez przesuwania.
- Modal i Sheet przechodzą testy klawiatury, fokusu, zamykania i ARIA.

### Stan

- [x] Fizyka i testy
- [x] Centralne tokeny
- [x] Button / Modal / Sheet
- [x] Nawigacja i swipe
- [x] Haptyka
- [x] Windows/PWA i Android/Capacitor (bez iOS)
- [x] Migracja starych wzorców
- [x] Weryfikacja (typecheck, lint, 301 testów, build PWA, frontend ratchet,
  wizualnie Windows + viewport Android, sync Android)
- [x] Natywny debug APK (Gradle/Java 21, zweryfikowany podpis v2 i zawartość assetów)

---

## Priorytet: Notatki — model Apple Notes 1:1

### Cel

Odtworzyć model pracy Apple Notes na webie: natychmiastowe przejście od znalezienia
notatki do pisania, jeden dokument bez osobnych pól tytułu i tagów, niezawodny zapis,
sesyjne odblokowanie oraz skanowanie dokumentów. Priorytetem jest jeden użytkownik,
więc prostota i szybkość mają pierwszeństwo przed skalowaniem i abstrakcjami.

### Zatwierdzony model produktu

1. **Układ**
   - desktop: foldery → lista notatek → edytor;
   - mobile: osobne ekrany folderów, notatek i edytora;
   - lista może zostać przełączona na Galerię; nie istnieje osobny tryb „Podział”.
2. **Dokument**
   - pierwsza linia treści jest tytułem; nie ma osobnego pola tytułu;
   - `#tag` wpisany w treści staje się tagiem po spacji lub Enter;
   - utworzenie tagu nigdy nie tworzy pomocniczej notatki;
   - porzucona, całkowicie pusta nowa notatka trafia do kosza bez komunikatu.
3. **Zapis**
   - autosave ma najwyżej jeden zapis w locie i scala zmiany powstałe w jego trakcie;
   - ostatni szkic zawsze wygrywa, także przy zmianie notatki i zamknięciu;
   - offline oznacza lokalny szkic awaryjny oraz jawne „Nie zapisano w chmurze”;
     nie używamy kolejki udającej poprawną synchronizację.
4. **Blokada**
   - treść i tagi pozostają zaszyfrowane w bazie przez cały czas;
   - tytuł pozostaje widoczny na liście jak w Apple Notes;
   - odblokowanie działa tylko w pamięci bieżącej sesji, wspólnie dla zablokowanych
     notatek, przez kilka minut;
   - „Zablokuj teraz”, wyjście z aplikacji lub wygaśnięcie sesji czyści plaintext;
   - ograniczenia Apple obowiązują: nie blokujemy notatek z tagami, audio, PDF-em,
     wideo ani dokumentem; obrazy i skany dokumentów są dozwolone.
5. **Powierzchnia edytora**
   - główny widok eksponuje treść, cofanie/ponawianie i przycisk załącznika;
   - formatowanie jest kontekstowe; AI, eksport, kolor, przypięcie, przeniesienie,
     archiwizacja, blokada i usuwanie mieszkają w menu `…`;
   - załącznik otwiera jedno menu: zdjęcie, plik, skan tekstu, skan dokumentu, audio.
6. **Skanowanie i OCR**
   - automatyczne lub ręczne przechwytywanie strony;
   - korekta czterech narożników, obrót i filtry obrazu;
   - ponawianie strony, wiele stron i wynikowy PDF;
   - „Skanuj tekst” wstawia rozpoznany tekst w miejscu kursora;
   - OCR skanów jest zapisany osobno i zasila wyszukiwanie, nie zmienia treści notatki.
7. **Pozostały cykl życia**
   - foldery, przypięcie, wyszukiwanie, Kosz, eksport i prywatne załączniki pozostają;
   - wyszukiwanie obejmuje treść, tytuł wynikający z pierwszej linii, tagi,
     nazwy załączników i OCR; dla zablokowanej notatki tylko widoczny tytuł.

### Architektura i dane

- Nadal istnieje jeden `InlineEditor` i jedna ścieżka zapisu przez `src/lib`.
- Kanonicznym dokumentem jest HTML `content`; `title` jest pochodną pierwszej linii
  utrzymywaną dla szybkiej listy i wyszukiwania.
- Tagi są pochodną aktywnych tokenów `#tag` w dokumencie.
- Kolejka autosave jest lokalnym szeregowym procesorem, nie systemem synchronizacji.
- Odszyfrowany payload żyje w pamięci kontrolera sesji, nigdy w React Query,
  `localStorage`, indeksie wyszukiwania ani bazie.
- Skaner jest wydzielonym przepływem UI; komponenty nie komunikują się bezpośrednio
  z Supabase. Oryginały/PDF trafiają do prywatnego Storage przez warstwę API.
- OCR wykorzystuje istniejący backend AI; brak odpowiedzi OCR nie blokuje zapisania PDF.

### Obsługa błędów

- Błąd autosave pozostawia szkic lokalnie i pokazuje trwałą akcję „Spróbuj ponownie”.
- Nieudane zamknięcie czeka na bieżący zapis; użytkownik nie traci nowszego szkicu.
- Niepoprawne hasło nie zmienia danych ani czasu sesji odblokowania.
- Nieudany OCR pozostawia skan i umożliwia ponowienie OCR.
- Nieudana pojedyncza strona skanu nie usuwa już zaakceptowanych stron.

### Kolejność wdrożenia

1. Szeregowy autosave i prosty szkic awaryjny.
2. Model pierwszej linii jako tytułu, tagi inline i sprzątanie pustych notatek.
3. Sesyjna blokada bez plaintextu w bazie.
4. Układ foldery/lista/edytor + Galeria i uproszczone menu.
5. Skaner wielostronicowy, PDF, OCR i wyszukiwanie.
6. Pełna weryfikacja desktop/mobile/offline/build.

### Plan techniczny

#### Zadanie 1: zapis dokumentu

- Rozszerzyć `useNoteDraftAutosave.test.ts` o równoległe opóźnione zapisy, zmiany
  podczas zapisu, flush przy przejściu i trwały błąd.
- Zmienić `useNoteDraftAutosave.ts` w procesor z jednym zapisem w locie oraz jednym
  scalonym oczekującym szkicem.
- Zastąpić kolejkę offline Notatek lokalnym szkicem awaryjnym przypisanym do ID.
- Zweryfikować testy hooka, typy i lint.

#### Zadanie 2: jeden dokument

- Dodać czyste funkcje wyznaczające tytuł z pierwszej linii i aktywne `#tagi`.
- Usunąć pola tytułu/tagów z edytora oraz ręczne tworzenie tagu z sidebara.
- Przy zapisie wyprowadzać `title` i `tags` z HTML dokumentu.
- Oznaczać nowe notatki i przenosić całkowicie puste do Kosza przy zamknięciu.
- Zweryfikować wyszukiwanie, podglądy, eksport i szybkie przechwytywanie.

#### Zadanie 3: blokada sesyjna

- Dodać kontroler pamięciowej sesji odblokowania z czasem wygaśnięcia i „Zablokuj teraz”.
- Zapis odblokowanej notatki szyfrować przed wywołaniem API; nie zapisywać plaintextu
  do cache ani lokalnego szkicu.
- Zachować jawny tytuł i egzekwować ograniczenia załączników/tagów.
- Dodać testy wygaśnięcia, ponownego blokowania i braku plaintextu.

#### Zadanie 4: układ i menu Apple

- Zastąpić tryby Grid/Split stałym układem desktopowym foldery/lista/edytor.
- Dodać przełącznik Lista/Galeria dla środkowej kolumny oraz mobilny stos ekranów.
- Przenieść akcje drugorzędne do menu `…` i połączyć wszystkie załączniki w jedno menu.
- Usunąć martwe komponenty, style i stan poprzednich trybów.

#### Zadanie 5: skaner i OCR

- Dodać model stron skanu oraz testy korekty narożników, obrotu i filtrów.
- Zbudować przechwytywanie aparatem/plikiem, ręczne narożniki i podgląd wielu stron.
- Generować jeden PDF i przesyłać go istniejącą warstwą załączników.
- Dodać backendowy tryb OCR, zapis osobnego tekstu OCR i włączenie go do wyszukiwania.
- Dodać „Skanuj tekst”, które wstawia wynik w bieżącym miejscu kursora.

#### Zadanie 6: brama końcowa

- Uruchomić testy Notatek, pełny typecheck, focused lint i produkcyjny build.
- Sprawdzić ręcznie utworzenie, szybkie pisanie, zmianę notatki, offline, blokadę,
  skan wielostronicowy, OCR, wyszukiwanie, Kosz i eksport na desktopie/mobile.

### Bramy jakości

- Każda funkcja zaczyna się od testu, który najpierw nie przechodzi.
- Nowe pliki UI mają mniej niż 300 linii; kontenery nie mieszają zapytań z JSX.
- Brak bezpośredniego Supabase i natywnych dialogów w komponentach.
- Po każdym etapie: testy obszaru, `npm run typecheck:ui`, lint i kontrola martwego kodu.
- Przed końcem: pełna ścieżka użytkownika na desktopie i mobile oraz test produkcyjnego buildu.

### Stan

- [x] Szeregowy autosave i szkic awaryjny
- [x] Dokument Apple: tytuł z pierwszej linii, tagi inline, puste notatki
- [x] Sesyjna blokada
- [x] Układ Apple i uproszczone menu
- [x] Skaner wielostronicowy, PDF i OCR
- [ ] Weryfikacja całości

---

## Stan: Capacitor Android — Faza 5 + 6 ✅ (2026-07-21)

### DONE (Faza 5 — sync w tle)

- `TelemetryForegroundService` — FGS typu `location`, powiadomienie „Sync aktywny”
- `BackgroundSyncPlugin` — start/stop, tick co ~15 min → `syncPhoneUsageToday` + `syncLocationNow`
- Wizard w ⚙️ Ustawienia: bateria, autostart (Xiaomi/OPPO/Vivo/Huawei fallback), GPS, toggle sync w tle
- `locationSync` — watchPosition nie zatrzymuje się gdy FGS aktywny
- Manifest: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`

### DONE (Faza 6 — polish)

- Ikona launchera z `public/pwa-*.png` (tło adaptive `#1C1917`)
- Share target `ACTION_SEND text/plain` → `/links` lub `/keep`
- Static shortcuts: Zadania, Linki, Notatki (`res/xml/shortcuts.xml`)
- Deep links `https://localhost/...` + `ShareIntentPlugin` + `initNativeIntents`

### NEXT

- Faza 7 (opcjonalnie): widgety
- Final (~3 tyg.): Oura Gen 3 BLE (noop slice) — wymaga FGS

### DONE wcześniej

- Faza 4 lokalizacja → `location_history`
- Faza 3 Usage Stats → `phone_usage_daily`
- Faza 2 FCM push
- Faza 1 bootstrap Capacitor
