# Vanguard OS — Behavioral Operating System (Manifesto)

> **Historical vision document.** Canonical runtime status lives in [`docs/FEATURE_LIFECYCLE.md`](FEATURE_LIFECYCLE.md), [`AGENTS.md`](../AGENTS.md), and [`supabase/functions/README.md`](../supabase/functions/README.md). Do not revive deprecated or dropped features from this manifesto without an explicit product decision.

## 1. Filozofia Systemu

Vanguard OS to prywatny behavioral operating system dla jednej osoby.

Nie jest to journaling app, tracker nawyków ani AI coach/mentor.

Jego zadanie jest inne: **zbierać rzeczywiste dane behawioralne** (głosówki, planowanie, decyzje, biometrię, aktywność, screen time) i budować z nich długoterminową, możliwie obiektywną warstwę dowodów o zachowaniu.

**Centralna zasada:**
System mierzy zachowanie. Użytkownik nadaje mu znaczenie.

AI nie ma tutaj wymyślać porad, motywować ani odgrywać roli mądrego przyjaciela/terapeuty. Ma strukturyzować dane, wykrywać rozjazdy między tym co deklarujemy a tym co faktycznie robimy, oraz utrzymywać ciągłość pamięci behawioralnej w czasie — tak, żeby użytkownik mógł konfrontować się z rzeczywistością zamiast z własną narracją.

## 2. Stack Technologiczny (Vanguard 5.0)
- **Frontend:** React 19 + Vite + Tailwind CSS (Vanilla).
- **Backend:** Supabase (PostgreSQL + Edge Functions).
- **AI Core:** DeepSeek `deepseek-v4-flash` (wszystkie funkcje, default) + `deepseek-reasoner` (tryb `!!` deep mode).
- **Memory Engine:** OpenAI `text-embedding-3-small` (Pamięć semantyczna).
- **Hosting/Deploy:** Supabase CLI / Vercel.

## 3. Strumienie Danych (Automatyczne)
- **Oura Ring:** HRV, sen, temperatura, readiness score.
- **ActivityWatch (Desktop):** Każda aplikacja, okno i czas spędzony przed komputerem.
- **StayFree (Mobile):** Czas w aplikacjach na telefonie, korelacje dopaminowe.
- **Yazio (Nutrition):** Kalorie, makroskładniki (szczególnie białko).
- **Google Calendar:** Auto-sync planu dnia co 2 godziny.
- **Manual Logs:** Treningi (serie, ciężar, RPE), waga, tkanka tłuszczowa, Power Lista.

## 4. Główne Moduły
### Dashboard / Mirror
- HUD ze wskaźnikami: **Focus, Recovery, Stability** (z-score).
- **System Mirror Mode:** Jednostronne lustro AI. Krótkie obserwacje bez pytań.

### Power Lista
- 5 zadań na dziś. Statystyki 30 dni (Zwycięstwo/Porażka).
- Oracle widzi nazwy zadań i ich status, wykrywając dryf od priorytetów.

### Oracle Chat (Mentor)
- Pełny kontekst życia Jakuba.
- Zasada: Max 5 zdań + jedno głębokie pytanie na końcu.
- Brak tematów tabu: Relacje, seksualność, pragnienia, mroczna strona.

### Telegram Bot
- **Bez prefiksu:** Zapis myśli do strumienia.
- **?**: Krótka rozmowa.
- **!!**: Tryb głębokiej analizy — model `deepseek-reasoner`.
- **@**: Pełny raport operacyjny.

### Intention Tracker (Silnik Dyscypliny)
- Monitoruje zgodność aktywności z planem.
- Tryby: `EXECUTION REQUIRED`, `CRITICAL ALIGNMENT`, `EARNED RECOVERY`.

## 5. Mechanizm Oracle (Logika Pamięci)
1. **Context Assembly:** Przy każdym zapytaniu system buduje wektor stanu (Oura + Yazio + Footprint + Kalendarz + Power List).
2. **Semantic Retrieval:** Wyszukiwanie wektorowe (HippoRAG) + graf behawioralny — re-ranking current-first.
3. **Reasoning:** `deepseek-v4-flash` analizuje dane i historię. Tryb `!!` → `deepseek-reasoner`.
4. **Memory Loop:** ~~Po rozmowie model zapisuje wnioski do bazy wiedzy.~~ **WYŁĄCZONY** (Sprint 0.7) — Oracle tylko czyta. Zapis wyłącznie przez `vanguard_stream → vanguard-auto-classify`.

## 6. Zasady Tożsamości Oracle
- Nie jest asystentem produktywności, coachem motywacyjnym ani terapeutą.
- Jest narzędziem do konfrontacji z behavioral evidence — pokazuje rozjazdy między tym, co deklarujemy, a tym, co faktycznie robimy.
- Oracle nie "zna Jakuba lepiej niż on sam". Ma dostęp do większej ilości surowych danych behawioralnych i dłuższej pamięci niż pojedynczy człowiek w danym momencie.
- Jego rola: strukturyzować dane, utrzymywać ciągłość obserwacji i pomagać użytkownikowi widzieć własne wzorce bez narracyjnego zniekształcenia.

## 7. Status & Rozwój (Maj 2026)
- System w pełni operacyjny (27 Edge Functions, pełna pętla dzienna).
- **Live:** Morning brief, midday check, reconciliation wieczorna, planning session, friction detection, HippoRAG Oracle.
- **Następne etapy:** Drift Detection / Reality Weighting (Sprint 1+), confirmed_friction_events VIEW, closure proposals approval flow.

---

## 8. Kluczowy Profil Użytkownika (Audit 2026-05-13)
*Ta sekcja służy jako "Zero Point" dla AI. Wszystkie inne dane muszą być spójne z poniższymi faktami.*

- **Osoba:** Jakub, ur. 6 lipca 2002 (23 lata w maju 2026).
- **Lokalizacja:** Rzeszów.
- **Edukacja:** Inżynier Analizy Danych (PRz). Obecnie: Magisterka Cyberbezpieczeństwo (1. semestr, PRz).
- **Relacje:** 
    - Julia Tomoń (pierwszy poważny związek, 2021).
    - Klaudia i Julia Ekiert (poprawne nazwiska znajomych/relacji).
    - Blokada: Trudność w inicjowaniu kontaktu fizycznego, lęk przed dotykiem.
- **Kluczowe Wydarzenia:** Maraton w Koszycach (4 października 2026). Trening startuje 1 czerwca 2026.
- **Główne Wątki:** Budowanie "Zintegrowanego Mężczyzny", High Agency, walka z perfekcjonizmem i prokrastynacją ("dryfowanie"), szybkie mówienie (do skorygowania).
