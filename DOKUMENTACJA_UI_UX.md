# HUMAN OS: Tactical UI/UX Blueprint (V2.4)
**Status:** FINAL DESIGN SYSTEM
**Estetyka:** Cyber-Brutalist / Hacker Console / Tactical HUD

---

## 1. Globalny Design System (Zasady Gry)

### Fundamenty Interfejsu
- **Nawigacja (PWA Optimization):** Obowiązkowy **Bottom Navigation Bar** na mobile. Wszystkie kluczowe akcje w zasięgu kciuka.
- **Haptyka (Vibration API):** Każda interakcja zmieniająca stan (checkpoint, save, RPE) musi wywoływać fizyczne wibracje. System ma "kopać" przy egzekucji.
- **Zarządzanie Halacją:** 
    - Globalne tło i ramki: Czysta czerń (`#000000`).
    - Kontenery danych (Wykresy, Mentor, Kierunek): Bardzo ciemny grafit (`#0A0A0A`).
- **Typografia techniczna:**
    - Teksty: Surowy krój bezszeryfowy (np. Inter).
    - Dane liczbowe (HRV, Waga, RPE, Czas): **Monospace** (np. Roboto Mono) – zapobiega "skakaniu" cyfr.
    - Brak zaokrąglonych ikon. Tylko ostre krawędzie.

---

## 2. Dynamiczny "State Engine" (UX Kontekstowy)
Interfejs musi reagować na Twój stan behawioralny poprzez zmienne CSS:

| Stan Systemu | Kolor Przewodni | Charakterystyka UI |
| :--- | :--- | :--- |
| **LOCKED_IN** | Neon Green (`#00FF00`) | Płynne animacje, czysty HUD, brak ostrzeżeń. |
| **CHAOS** | Blood Red (`#FF0055`) | Brutalne przejścia, AI Mirror na samej górze, wyszarzone rozpraszacze. |
| **AVOIDANCE** | Warning Yellow (`#FBFF00`) | Pulsujące krawędzie Power Listy, wymuszone popupy z pytaniem o progres. |
| **RECOVERY** | Cold Blue (`#00E5FF`) | Blokada ekranu treningowego, priorytet dla wykresów snu. |

---

## 3. Architektura Widoków (Wireframing)

### A. DASHBOARD (Terminal Główny) - HUD
- **Header:** Logotyp `KUBA_OS` + `OperatingStateWidget`. W stanie CHAOS tło headera pulsuje na czerwono.
- **Identity Score (Hero):** Gigantyczna liczba (np. 87%) na 1/3 ekranu. Pod nią `sparkline` (trend 7 dni).
- **Grid Danych:** Oura Advanced (2x2). Surowe kwadraty: Cyfra | Jednostka | Trend.
- **Alert Box (Dół):** Mirror Mode (AI). Styl linii komend (CLI), efekt `typewriter` przy ładowaniu analizy.

### B. MENTOR (Centrum Strategiczne) - Debug Console
- **Status Bar:** Nagłówek `SYSTEM_OVERSEER_ACTIVE` z mrugającym kursorem.
- **Chat:** 
    - Twoje wiadomości: Prawa strona, szare, surowe.
    - AI: Cała szerokość, kolor zależny od `StateEngine`. 
    - Brak dymków – tylko ostre prostokąty.
- **Footer:** Przycisk `[ SEND_DATA ]`. Ukryty (Double Tap) przycisk `[ PURGE_MEMORY ]` z czerwoną obwódką.

### C. KIERUNEK (War Room) - Logistics
- **Visual Correlation:** Dwa nakładające się paski postępu: `StayFree Sync` vs `Power List`. Wizualizacja jak czas przed ekranem "zjada" Twoje zadania.
- **Power List:** 5 masywnych, horyzontalnych bloków. Kliknięcie = potężna wibracja + brutalne przekreślenie tekstu.
- **Archive:** Sekcja "Fundament" ukryta w akordeonach (collapsibles), aby nie rozpraszać uwagi.

### D. TRENING (Execution Deck) - High-Intensity UX
- **Header:** `MSP Indicator` (Target weight / In Progress).
- **Lista Ćwiczeń:** Aktywny tylko JEDEN wiersz. Przeszłość wyszarzona, przyszłość zwinięta.
- **Custom Numpad:** Zamiast klawiatury systemowej – wielki, dedykowany panel numeryczny na 1/2 ekranu. Przyciski skrótów: `+2.5`, `+5`, `RPE 8.5`, `RPE 9`.

### E. STATYSTYKI & DOWODY (Medical Documentation)
- **Data Layers:** Wykresy liniowe z możliwością nakładania (np. Kalorie vs HRV).
- **Photo Compare:** Suwak Before/After. Zdjęcia w trybie czarno-białym (filtr medyczny/dokumentalny). Zero upiększeń.

---

## 4. Wytyczne Techniczne dla Dev/Designer
- **PWA:** Musi działać offline (Service Workers).
- **Performance:** Czas ładowania Dashboardu < 1s.
- **Vibration API:** Implementacja w `src/hooks/useHaptics.js`.
