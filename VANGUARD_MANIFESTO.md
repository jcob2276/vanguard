# Vanguard OS — Personal Intelligence System (Manifesto & Tech Overview)

## 1. Filozofia Systemu
Vanguard OS to prywatna aplikacja webowa zaprojektowana dla jednej osoby — Jakuba. To nie jest tracker nawyków ani planer. To system działający w tle 24/7, który buduje coraz głębszy model właściciela — biologiczny, psychologiczny i behawioralny. 

**Centralny element:** AI Oracle — bot, który zna Jakuba lepiej niż on sam, ponieważ widzi wszystkie wymiary jego życia jednocześnie i bez emocjonalnego filtra.

## 2. Stack Technologiczny (Vanguard 5.0)
- **Frontend:** React 19 + Vite + Tailwind CSS (Vanilla).
- **Backend:** Supabase (PostgreSQL + Edge Functions).
- **AI Core:** DeepSeek V4 Pro (Główny model, tryb `think_high`).
- **Memory Engine:** OpenAI `text-embedding-3-small` (Pamięć semantyczna).
- **Extraction:** DeepSeek V4 Flash (Szybka ekstrakcja wiedzy w tle).
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
- **!!**: Zapis "Żelaznych Zasad" (Importance 10).
- **@**: Pełny raport operacyjny.

### Intention Tracker (Silnik Dyscypliny)
- Monitoruje zgodność aktywności z planem.
- Tryby: `EXECUTION REQUIRED`, `CRITICAL ALIGNMENT`, `EARNED RECOVERY`.

## 5. Mechanizm Oracle (Logika Pamięci)
1. **Context Assembly:** Przy każdym zapytaniu system buduje wektor stanu (Oura + Yazio + Footprint + Kalendarz + Power List).
2. **Semantic Retrieval:** Wyszukiwanie wektorowe znajduje podobne sytuacje z przeszłości.
3. **Reasoning:** DeepSeek V4 Pro analizuje dane i historię.
4. **Memory Loop:** Po rozmowie model Flash wyciąga wnioski i zapisuje je do bazy wiedzy.

## 6. Zasady Tożsamości Oracle
- Nie jest asystentem produktywności ani coachem motywacyjnym.
- Jest obserwatorem, którego misją jest poznać Jakuba lepiej niż on sam.
- **Zasada Ciekawości:** Każda emocja lub złamanie nawyku to trigger do pytania o przyczynę.
- **Zasada Mirroringu:** Nigdy nie odzwierciedla emocji ("też tak mam"), zawsze drąży ich źródło.

## 7. Status & Rozwój (Maj 2026)
- System w pełni operacyjny (25 tabel, 12 Edge Functions).
- **Następne etapy:** Daily snapshot (raporty poranne), mapa relacji osób trzecich, integracja z Notion/Readwise.
