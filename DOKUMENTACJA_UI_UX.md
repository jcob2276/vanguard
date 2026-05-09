# Blueprint Systemu Operacyjnego Tożsamości (Kuba OS V2.2)
**Specyfikacja Funkcjonalna dla UI/UX Designer**

---

## 1. Filozofia Systemu
To nie jest tracker aktywności. To **system interpretacyjny**. UI musi odzwierciedlać brutalną dyscyplinę, dane biometryczne i behawioralne. Design powinien być nowoczesny, ciemny (Dark Mode), z silnymi akcentami kolorystycznymi (Brutalist / Cyberpunk / High-Contrast).

---

## 2. Architektura Widoków (Sitemap)

### A. Dashboard (Główny Hub Kontrolny)
**Cel:** Natychmiastowa diagnoza stanu operacyjnego.
*   **Operating State Widget (Dynamiczny):** 
    *   Stany: `LOCKED_IN` (Zielony/Neon), `CHAOS` (Czerwony/Alarm), `AVOIDANCE` (Żółty), `RECOVERY` (Niebieski).
    *   UI musi zmieniać kolorystykę całej sekcji w zależności od stanu.
*   **Identity Score (Wskaźnik Spójności):** Centralny licznik % (0-100). Pokazuje, jak bardzo działania Kuby pokrywają się z jego deklarowanymi celami.
*   **Oura Advanced Widget:** 
    *   Dane: Sen (h), Gotowość (%), HRV (zmienność tętna), RHR (tętno spoczynkowe).
    *   Wizualizacja: Progres bary lub minimalistyczne wykresy kołowe.
*   **Mirror Mode (AI Insight):** Pole tekstowe, w którym "Głos Systemu" (AI) podaje 1-2 zdania bezlitosnej prawdy na podstawie danych.

### B. Mentor (Centrum Strategiczne - AI Chat)
**Cel:** Głęboka rozmowa z systemem o wzorcach zachowań.
*   **Interfejs:** Pełny czat z historią.
*   **Kontekst:** AI widzi wszystkie dane pod spodem. Czat musi wyglądać jak "terminal dowodzenia".
*   **Funkcje:** Przycisk czyszczenia pamięci, wskaźnik "System thinking".

### C. Kierunek (Self-Awareness & Logistyka)
**Cel:** Planowanie i analiza wzorców cyfrowych.
*   **Fundament (Life Goals):** Trzy sekcje: Ciało, Duch, Konto. Możliwość edycji i podglądu "Północy" (celów ostatecznych).
*   **StayFree Digital Sync:** Importer danych o czasie przed ekranem.
    *   Wizualizacja korelacji: Ile h na telefonie vs dowiezione zadania.
*   **Power List:** Lista 5 krytycznych zadań na dziś. Statusy: Win (Z) / Loss (P).

### D. Trening (Execution)
**Cel:** Brutalne skupienie na treningu siłowym.
*   **Progression Table:** Tabela z planowanymi ciężarami na cel: 100 kg Bench Press.
*   **Workout Logger:** Rejestrowanie serii, powtórzeń i RPE (skala trudności).
*   **MSP Indicator:** Wskaźnik "Maximum Strength Phase" – czy dany trening był rekordowy.

### E. Statystyki & Zdjęcia
**Cel:** Dowód transformacji.
*   **Wykresy:** Kalorie vs Waga vs HRV.
*   **Galeria:** Porównywarka zdjęć sylwetki (Before/After).

---

## 3. Logika "State Engine" (Dla UI)
Designer musi zaplanować stany UI dla następujących warunków:
*   **LOCKED_IN:** Power Lista dowieziona, Trening zrobiony, Sen > 7.5h. (Design: Peak Performance).
*   **CHAOS:** Power Lista pusta, Sen < 6h, StayFree > 4h. (Design: Warning/High Stress).
*   **RECOVERY:** Niskie HRV, wysoka temperatura, brak treningu. (Design: Chill/System Maintenance).

---

## 4. Wytyczne Wizualne
*   **Typografia:** Kroje bezszeryfowe, pogrubione (np. Inter Black, Roboto Mono).
*   **Kolory:** 
    *   Background: `#000000` lub głęboki grafit.
    *   Primary: `#FBFF00` (Jaskrawy żółty) lub `#00FF00` (Neon zielony).
    *   Accents: `#FF0055` (Alert/Danger).
*   **Klimat:** "Military Grade Tech" / "High Performance Lab".
