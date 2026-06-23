# MEMEX → VANGUARD: Plan wdrożenia

> Plik przekazywany między agentami AI. Każdy agent czyta **cały plik** przed pracą,
> wykonuje swoją fazę, a potem **dopisuje log** na końcu sekcji „Dziennik wykonania".
> Następny agent widzi co było zrobione i nie powtarza pracy.

---

## KONTEKST PROJEKTU

**Vanguard OS** — osobisty system operacyjny Jakuba.

**Stack:**
- Frontend: React 19 + TypeScript + Vite + TailwindCSS 4, SPA na Vercel
- Backend: Supabase (PostgreSQL + Auth + RLS + Edge Functions na Deno)
- AI: DeepSeek (główny LLM), edge function `vanguard-oracle`
- Komunikacja: Telegram bot (`vanguard-telegram`)
- Repo: `C:\Users\jakub\Desktop\Vanguard`

**Kluczowe pliki:**
- `supabase/functions/vanguard-oracle/index.ts` — główny agent AI
- `supabase/functions/vanguard-analyst/index.ts` — analityk nocny
- `supabase/functions/_shared/` — wspólne helpery (deepseek.ts, supabase.ts, time.ts)
- `src/components/ai/OracleCard.tsx` — chat UI Oracle
- `src/styles/` lub Tailwind config — design tokens
- `lessons.md` — lekcje agenta (ZAWSZE czytaj przed pracą, ZAWSZE aktualizuj po błędach)
- `docs/DEV_GUIDE.md` — zasady techniczne (timezone Warsaw, createServiceClient, resolveUserScope)

**Nienaruszalne zasady (z DEV_GUIDE.md):**
- Timezone: zawsze `Europe/Warsaw`, nigdy `new Date()` bez timeZone
- Supabase: zawsze `createServiceClient()` + `resolveUserScope()`
- Po `insert/update` bez `.select()` — sprawdzaj `{ error }` ręcznie, NIE używaj `unwrap()`
- `unwrap()` / `unwrapList()` tylko dla zapytań z `.select()`

**Źródło wzorców:** `C:\Users\jakub\Desktop\memex-explore\VANGUARD_MEMEX_STEAL.md`
— 64 wzorce z aplikacji Memex (Flutter/Dart), przetłumaczone na React/TS/Supabase.
Czytaj ten plik po szczegóły implementacyjne (interfejsy, CSS, logika).

---

## STATUS FAZ

| Faza | Nazwa | Status | Agent | Data |
|---|---|---|---|---|
| 1 | Prompty Oracle | ✅ DONE | Claude Sonnet 4.6 | 2026-06-23 |
| 2 | Design System | ✅ DONE | Claude Sonnet 4.6 | 2026-06-23 |
| 3 | ClarificationRequest | ✅ DONE | Claude Sonnet 4.6 | 2026-06-23 |
| 4 | Chat UI Upgrade | ✅ DONE | Claude Sonnet 4.6 | 2026-06-23 |
| 5 | 22 Karty + 13 Widgetów | ✅ DONE | Claude Sonnet 4.6 | 2026-06-23 |
| 6 | Magazine Bar / Schedule | ✅ DONE | Claude Sonnet 4.6 | 2026-06-23 |
| 7 | Stats & Insights | ✅ DONE | Claude Sonnet 4.6 | 2026-06-23 |
| 8 | Advanced Agent Infra | ✅ DONE | Claude Sonnet 4.6 | 2026-06-23 |

Statusy: ⬜ TODO → 🔄 IN PROGRESS → ✅ DONE → ⚠️ PARTIAL (opisz co zostało)

---

## FAZA 1 — Prompty Oracle

**Cel:** Przepisać system prompty Oracle i Analyst bez żadnych zmian w kodzie.
**Szacowany czas:** 1-2 dni
**Zależności:** brak — zacznij tutaj

### Co zrobić

**1a. Przepisać system prompt `vanguard-oracle`** wg zasad z wzorca #3:
- "Orchestrator, not one-shot chatbot"
- "Smallest thing that fully serves intent — nie rób więcej niż trzeba"
- "Report only what tool results prove — nigdy nie wymyślaj wyjaśnień dla błędów"
- "Correct comprehensively, not one fragment — jak naprawiasz, napraw wszystko"
- "Never invent explanation for failure — jeśli tool zawiedzie, powiedz to wprost"
- Dodaj sekcję parallel execution: "emit multiple tool calls in same turn when independent"

**1b. Dodać Default Deny do sekcji pamięci Oracle** (wzorzec #4):
```
Zapisuj do pamięci TYLKO:
- Identity (imię, role, wiek, stałe cechy)
- Strong Preferences (powtarzające się, nie jednorazowe)
- Long-term Assets (projekty, narzędzia, nawyki)
- AI Interaction Preferences

NIE zapisuj:
- Transient context ("pytał o X")
- One-off actions / jednorazowe zdarzenia
- Already-known facts
- Tasks, todos, chat logs
- Timestamps i jednorazowe ID

Format: 3rd person, atomic facts
BAD: "Użytkownik zapytał o dietę w poniedziałek"
GOOD: "Preferuje dietę wysokobiałkową, cel: maraton 4.10.26"
```

**1c. Dodać 4 Lenses do `vanguard-analyst`** (wzorzec #2):
Przy każdej analizie danych patrz przez 4 wymiary:
```
1. Hidden Contexts — co jest tłem/kontekstem co nie jest oczywiste?
2. Energy Tides — kiedy energia/momentum jest wysoka vs niska?
3. Micro-Consistency — co jest spójne między małymi zdarzeniami?
4. Interactive Curiosity — co byś chciał zbadać głębiej?
```

**1d. Companion tone dla Oracle chat** (wzorzec #34):
Dodaj do sekcji stylu Oracle 8 możliwych "moves":
```
casual_continuation, emotional_witnessing, playful_banter,
gentle_reflection, practical_help, celebration,
protective_boundary, safety_escalation
Max 2 moves per odpowiedź. NIE kończ każdej odpowiedzi pytaniem.
```

**1e. Memory Summarize Prompt** (wzorzec #37):
Jeśli Oracle kompresuje historię/pamięć, użyj promptu:
```
Role: Expert User Profile Builder
Convert Events to Attributes (NIE loguj, profiluj).
Aggressive Merging: 5 wpisów o tym samym → 1 bullet.
Output: Markdown (Identity / Interests / Assets / Focus), max 2000 chars.
```

### Definition of Done
- [ ] `vanguard-oracle/index.ts` — system prompt zawiera zasady Orchestrator
- [ ] `vanguard-oracle/index.ts` — sekcja pamięci ma Default Deny policy
- [ ] `vanguard-oracle/index.ts` — companion tone z 8 moves
- [ ] `vanguard-analyst/index.ts` — 4 Lenses w prompcie analitycznym
- [ ] Brak zmian w logice JS/TS — TYLKO stringi promptów
- [ ] `lessons.md` zaktualizowany jeśli napotkano problemy

---

## FAZA 2 — Design System

**Cel:** CSS tokens + GlassCard + 5 wariantów kart jako fundament pod całe UI.
**Szacowany czas:** 1-2 dni
**Zależności:** Faza 1 (niezależna, można równolegle)

### Co zrobić

**2a. CSS Design Tokens** (wzorce #21, #47, #48):

Stwórz lub rozszerz `src/styles/design-tokens.css` (albo Tailwind config):

```css
/* Kolory */
--color-primary: #5B6CFF;
--color-success: #10B981;
--color-warning: #F59E0B;
--color-danger: #F43F5E;
--color-bg: #F7F8FA;
--color-card: #FFFFFF;
--color-text-primary: #0A0A0A;
--color-text-secondary: #4A5565;
--color-text-tertiary: #99A1AF;

/* Cienie */
--shadow-card: 0 2px 16px rgba(0,0,0,0.05);
--shadow-card-accent: 0 0 24px rgba(17,24,39,0.05);
--shadow-float: 0 6px 24px rgba(0,0,0,0.08);
--shadow-back-btn: 0 0 9px rgba(0,0,0,0.04);

/* Typografia — wartości do Tailwind lub CSS */
/* brandTitle: Bricolage Grotesque 32px/w800/letterSpacing -0.41 */
/* cardTitle: 24px/w600/height 33/24/letterSpacing -0.45 */
/* data (big numbers): 24px/w800/height 1.0/letterSpacing -1.0 */
/* body: 15px/w400/height 1.6 */
/* small: 13px/w500/height 1.4 */
/* timestampHeader: 12px/w500/letterSpacing -0.15/textTertiary */
/* sectionTitle: 15px/w500/letterSpacing -0.15 */
```

**2b. GlassCard komponent** (wzorzec #60):

Plik: `src/components/ui/Card.tsx`

```tsx
// Variant: 'glass' | 'immersive' | 'canvas' | 'receipt' | 'outline'
// glass: white, radius 20, shadow-card, hover ripple
// immersive: gradient #0A0A0A, radius 24, shadow-float
// canvas: white + dot grid (20px spacing, 15% opacity), radius 20
// receipt: white + tertiary border 20%, radius 24, no shadow
// outline: transparent + tertiary border 30%, radius 24, no shadow
```

Canvas variant — dot grid jako CSS lub SVG pattern, NIE canvas element.

**2c. TimelineCard komponenty** (wzorzec z VANGUARD_MEMEX_STEAL.md Część IV):

Plik: `src/components/ui/TimelineCommon.tsx`
- `TimelineHeader` — [icon-container] [title bold] [subtitle small] [trailing]
- `TimelineFooter` — [tags wrap] [timestamp right]
- `TimelineTag` — `#label` w primary color
- `TimelineDivider` — solid (1px, tertiary 10%) lub dashed (5px boxes via CSS)

### Definition of Done
- [ ] CSS tokens dostępne globalnie (Tailwind lub CSS variables)
- [ ] `Card.tsx` eksportuje komponent z 5 wariantami
- [ ] `TimelineCommon.tsx` eksportuje Header/Footer/Tag/Divider
- [ ] Istniejące komponenty NIE zepsute (sprawdź `npm run build`)
- [ ] `lessons.md` zaktualizowany jeśli napotkano problemy

---

## FAZA 3 — ClarificationRequest System

**Cel:** Oracle może zadawać strukturalne pytania zamiast zgadywać.
**Szacowany czas:** 2-3 dni
**Zależności:** Faza 1 (prompt Oracle musi wiedzieć o tym toolie)

### Co zrobić

**3a. Migracja DB:**

```sql
CREATE TABLE oracle_clarification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  response_type TEXT NOT NULL CHECK (response_type IN ('confirm','single_choice','multi_choice','short_text')),
  options JSONB DEFAULT '[]',           -- [{id, label, value}]
  dedupe_key TEXT NOT NULL,             -- nie duplikuj jeśli ten sam klucz
  evidence_fact_ids TEXT[] DEFAULT '{}',
  proposed_memory TEXT,
  confidence FLOAT DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','answered','dismissed')),
  answer JSONB,                         -- {option_ids[], text, is_custom_answer, is_uncertain}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);
-- RLS: user widzi tylko swoje
ALTER TABLE oracle_clarification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user own" ON oracle_clarification_requests FOR ALL USING (auth.uid() = user_id);
```

**3b. Tool w `vanguard-oracle`:**

```typescript
// Tool schema do dodania w system prompcie Oracle
{
  name: "create_clarification_request",
  description: "Zadaj strukturalne pytanie użytkownikowi gdy nie masz pewności. Użyj gdy confidence < 0.7.",
  parameters: {
    question: string,           // jasne, konkretne pytanie
    response_type: "confirm" | "single_choice" | "multi_choice" | "short_text",
    options?: [{id, label, value}],  // dla choice typów
    dedupe_key: string,         // unikalny klucz, np. "diet_preference_2026"
    evidence_fact_ids?: string[], // z czego wnioskujesz
    proposed_memory?: string,    // co chcesz zapamiętać po odpowiedzi
    confidence?: number          // 0-1
  }
}
```

Tool handler w edge function → INSERT do `oracle_clarification_requests` → zwróć `{status: 'pending', request_id}`.

**3c. React UI** — plik `src/components/ai/ClarificationRequestCard.tsx`:

```
Layout kart pytania:
- Pytanie tekst (bold)
- confirm → dwa przyciski Tak/Nie
- single_choice → radio lista opcji
- multi_choice → checkbox lista opcji
- short_text → text input z wysyłką

Zawsze dopisywane automatycznie:
- "__uncertain__" → "Nie jestem pewny/a" (jeśli brak podobnej opcji w liście)
- "__other__" → "Inna odpowiedź" → otwiera text input (auto-focus, zwija jeśli pusty)

Po odpowiedzi: PATCH answer + answered_at → trigger nowej tury Oracle z kontekstem
```

**3d. Wyświetlanie w OracleCard.tsx:**
- Po każdej odpowiedzi Oracle sprawdź czy jest `pending` clarification request dla usera
- Jeśli tak → renderuj `ClarificationRequestCard` nad input boxem

### Definition of Done
- [ ] Migracja w `supabase/migrations/` (z timestampem)
- [ ] RLS działa (user widzi tylko swoje rekordy)
- [ ] Tool zdefiniowany w prompt Oracle
- [ ] Handler w edge function zapisuje do tabeli
- [ ] `ClarificationRequestCard.tsx` renderuje wszystkie 4 typy
- [ ] `__uncertain__` i `__other__` działają poprawnie
- [ ] Po odpowiedzi Oracle dostaje kontekst i kontynuuje
- [ ] `lessons.md` zaktualizowany

---

## FAZA 4 — Chat UI Upgrade

**Cel:** Bogatsza struktura wiadomości w czacie Oracle — myślenie, tool calle, animacje.
**Szacowany czas:** 2 dni
**Zależności:** Faza 2 (potrzebuje Card.tsx)

### Co zrobić

**4a. Hierarchia wiadomości** — rozszerzyć `OracleCard.tsx` lub wydzielić typy:

```typescript
type ChatItem =
  | { type: 'user';     text: string; refs?: {title,content,type}[]; images?: string[] }
  | { type: 'ai';       text: string; isStreaming?: boolean }
  | { type: 'thinking'; text: string; isExpanded: boolean; isFinished: boolean }
  | { type: 'tool';     name: string; args: string; result?: string; isError?: boolean;
                        duration?: number; isExpanded: boolean; children?: ToolItem[] }
  | { type: 'artifact'; title: string; content: string; html?: string }
  | { type: 'approval'; request: PendingAction; status: 'pending'|'approved'|'denied' }
  | { type: 'error';    text: string }
```

`ThinkingItem` — collapsible, ikona "mózg", szary kolor, tekst kursywą.
`ToolCallItem` — collapsible, ikona "terminal", czas wykonania, nested children dla sub-agentów.

**4b. Animacja chat sheet** (wzorzec #50):

```typescript
// Slide-up + fade gdy chat się otwiera
// duration: 500ms, curve: easeOutCubic
// slide: translateY(100%) → translateY(0)
// fade: opacity 0 → 1 (easeOut)
// height: 75vh (lub 100vh w fullscreen mode)
// keyboard: gdy keyboard pojawi się → shrink height do screenHeight - keyboardHeight
// borderRadius: top-left/right 32px (0 w fullscreen)
```

**4c. Bounce animacja przycisku Oracle** (wzorzec #49):

```typescript
// Tap: scale 1.0 → 0.9 (150ms) → 1.0
// CSS transform + transition
// Long press: trigger bez animacji
```

**4d. Time divider między wiadomościami** (wzorzec #50):

```
same day    → "14:35"
yesterday   → "Wczoraj 14:35"
< 7 days    → "Pon 14:35"
same year   → "23 Cze 14:35"
other year  → "23 Cze 2025 14:35"
```

### Definition of Done
- [ ] Typy `ChatItem` zdefiniowane w TypeScript
- [ ] `ThinkingItem` renderuje się collapsibly
- [ ] `ToolCallItem` renderuje się z nazwą, args, duration
- [ ] Animacja slide-up przy otwieraniu chat
- [ ] Bounce animation na przycisku Oracle
- [ ] Time dividers między wiadomościami z różnych czasów
- [ ] `lessons.md` zaktualizowany

---

## FAZA 5 — 22 Typy Kart + 13 Widgetów

**Cel:** Oracle może zwracać bogate strukturyzowane dane, renderowane jako karty/wykresy.
**Szacowany czas:** 3-5 dni
**Zależności:** Faza 2 (Card.tsx), Faza 4 (struktura chat items)

### Co zrobić

Szczegółowe schematy wszystkich 35 komponentów → `VANGUARD_MEMEX_STEAL.md` Część II (#14) i Część III (#47 widgets).

**Karty** — katalog `src/components/cards/`:
```
entities/    link.tsx, person.tsx, place.tsx, spec_sheet.tsx, transaction.tsx
quantifiable/ metric.tsx, rating.tsx, mood.tsx, progress.tsx
visual/      canvas.tsx, gallery.tsx, snapshot.tsx, video.tsx
textual/     article.tsx, compact.tsx, conversation.tsx, insight_summary.tsx, quote.tsx, snippet.tsx
temporal/    duration.tsx, event.tsx, procedure.tsx, routine.tsx, task.tsx
system/      schedule_briefing.tsx
```

**Factory** — `src/components/cards/CardFactory.tsx`:
```typescript
export function CardFactory({ templateId, data, title, tags, onTap }) {
  switch(templateId) {
    case 'metric': return <MetricCard data={data} />
    // ...
  }
}
```

**13 Widgetów insight** — katalog `src/components/widgets/`:
```
MapCard.tsx, RouteMapCard.tsx, HighlightCard.tsx, CompositionCard.tsx,
ContrastCard.tsx, GalleryCard.tsx, BubbleChart.tsx, ProgressChart.tsx,
RadarChart.tsx, TrendChart.tsx, BarChart.tsx, TimelineWidget.tsx, SummaryCard.tsx
```

Dla wykresów użyj `recharts` lub `visx` — NIE canvas, NIE d3 bezpośrednio.

**Schema w prompcie Oracle** — dodaj TypeScript interfaces dla wszystkich 35 typów do system promptu Oracle żeby wiedział jak je generować.

### Definition of Done
- [ ] `CardFactory.tsx` obsługuje wszystkie 22 typy kart
- [ ] Wszystkie 13 widgetów renderują się z dummy data
- [ ] Oracle system prompt zawiera schematy (interfaces TS)
- [ ] OracleCard.tsx renderuje odpowiedź jako kartę gdy Oracle zwróci `{ templateId, data }`
- [ ] `lessons.md` zaktualizowany

---

## FAZA 6 — Magazine Bar / Schedule

**Cel:** Upgrade widoku tygodniowego — hero event, editorial intro, timeline.
**Szacowany czas:** 2 dni
**Zależności:** Faza 2 (Card.tsx), Faza 5 (opcjonalnie)

### Co zrobić

**6a. Model danych** — dodaj do Supabase lub lokalnego state (wzorzec #16):

```typescript
interface ScheduleViewData {
  id: string
  generatedAt: string
  hero?: { cardId: string; title: string; description?: string; startTime?: string; priority: number }
  editorialIntro: string          // krótki przegląd tygodnia (1-2 zdania)
  quoteBlocks: Array<{ title: string; content: string; priority: 'low'|'normal'|'high' }>  // max 2
  timeline: Array<{
    dayLabel: string              // "DZIŚ", "JUTRO", "PON 23 CZE"
    dayDate: string               // "2026-06-23"
    items: ScheduleItem[]
  }>                              // max 7 dni
  completed: CompletedItem[]
}
```

**6b. Hero Card UI** (wzorzec #23):

```css
background: linear-gradient(135deg, #172554, #0F766E);
border-radius: 16px; min-height: 188px;
border: 1px solid rgba(255,255,255,0.08);

/* "WYRÓŻNIONE" badge */
background: rgba(255,255,255,0.15); border-radius: 8px; padding: 4px 10px;
font: 10px/w600/letterSpacing 1px/uppercase; color: rgba(255,255,255,0.9);

/* Tytuł */
font: 21px/w700/lineHeight 1.2; color: white;
```

Hero = najbardziej znaczące zdarzenie, NIE następne chronologicznie.

**6c. Tools Oracle** — dodaj do edge function:

```typescript
set_presentation({ hero?, editorial_intro?, quote_blocks?, timeline_days[] })
add_pending_item({ kind: 'todo'|'event', title, source_fact_id, start_time?, due_at? })
complete_pending_item({ id })
```

**6d. sweepPastEventsInState** — czysta funkcja (wzorzec #45):

```typescript
function sweepPastEventsInState(state: ScheduleViewData, now: Date): ScheduleViewData {
  // przenieś events których pastAfter minął z pending do completed
}
```

### Definition of Done
- [ ] `ScheduleViewData` typ zdefiniowany w TS
- [ ] Hero Card renderuje się z gradientem i badge
- [ ] Timeline days renderują się chronologicznie
- [ ] Tools Oracle działają (set_presentation, add_pending_item)
- [ ] `sweepPastEventsInState` pokryta testami jednostkowymi
- [ ] `lessons.md` zaktualizowany

---

## FAZA 7 — Stats & Insights Dashboard

**Cel:** Karta aktywności + insight cards z pin/sort/delete.
**Szacowany czas:** 2 dni
**Zależności:** Faza 2, Faza 5 (opcjonalnie)

### Co zrobić

**7a. UserStatsSnapshot** (wzorzec #17) — widok/query z istniejących tabel:

```typescript
interface UserStatsSnapshot {
  totalInputs: number        // rekordy w vanguard_stream
  totalCards: number         // wygenerowane karty
  totalCompletedTodos: number
  activeDays: number         // dni z jakąkolwiek aktywnością
  currentStreakDays: number
  daily: Array<{ date: string; inputs: number; cards: number; completedTodos: number }>
}
```

**7b. UserStatsOverviewCard** (wzorzec #57):

```
Layout:
- Header: ikona stats + "Aktywność" + spinner/chevron
- Summary text: "X rekordów, Y kart, Z zadań"
- 3 MetricPills (row): Records (primary), Cards (success), Todos (warning)
  - MetricPill: value 17px/w800, label 11px, bg color(8%), radius 8
- MiniBarChart 42px: słupki = inputs+cards+todos, color primary(75%), min-height 8px
- Loading skeleton: szare rounded rects w tych samych pozycjach
```

**7c. KnowledgeInsightCard** (wzorzec #15) — tabela jeśli nie istnieje:

```sql
CREATE TABLE knowledge_insight_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  title TEXT NOT NULL,
  insight TEXT,
  widget_type TEXT DEFAULT 'native',
  widget_data JSONB DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  related_fact_ids TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE knowledge_insight_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user own" ON knowledge_insight_cards FOR ALL USING (auth.uid() = user_id);
```

**7d. Insight action overlay** (wzorzec #58) — long-press na insight card:

```
- Scrim rgba(0,0,0,0.6)
- Sort button: amber circle + sort icon, shadow amber(30%)
- Delete button: red circle + trash icon, loading spinner podczas usuwania
- Cancel X: biały circle top-right
```

**7e. Tools Oracle** dla insight cards:

```typescript
save_knowledge_insight_cards(cards: ChartData[])  // batch save, type: 'add'|'update'
delete_knowledge_insight_card(id: string)
get_exists_knowledge_insight_cards()               // lista istniejących (by ID nie duplikować)
```

### Definition of Done
- [ ] Query zwraca `UserStatsSnapshot` z realnych danych
- [ ] `UserStatsOverviewCard` renderuje się z prawdziwymi danymi
- [ ] Loading skeleton działa
- [ ] `knowledge_insight_cards` tabela z RLS
- [ ] Insight cards można pin/sort/delete
- [ ] Long-press overlay działa na mobile (touch events)
- [ ] Tools Oracle działają
- [ ] `lessons.md` zaktualizowany

---

## FAZA 8 — Advanced Agent Infrastructure

**Cel:** Context compression, run mode, parallel workers.
**Szacowany czas:** 3-5 dni
**Zależności:** Wszystkie poprzednie fazy

### Co zrobić

**8a. Rolling Context Compression** (wzorzec #5):

W `vanguard-oracle` — gdy historia przekroczy softRatio tokenu:
```
softRatio: 0.80 → zacznij kompresję
hardRatio: 0.95 → wymuś kompresję
keepRecent: 20 wiadomości verbatim (nie kompresuj ostatnich 20)
budget: 12,000 chars dla skompresowanego podsumowania

Pre-trim przed kompresją:
1. Deduplikacja identycznych wiadomości
2. Truncate args toolów > 600 znaków
3. Truncate linii > 4000 znaków
4. Wytnij na granicy tury (nie w środku tool call)
```

Użyj promptu z wzorca #37 (Expert User Profile Builder) do kompresji.

**8b. AgentRunMode** (wzorzec #39):

```typescript
type AgentRunMode = 'auto' | 'confirm' | 'readOnly'

// confirm mode: przed każdą mutacją → pokaż użytkownikowi summary + czekaj na OK
// readOnly: tylko query tools (SELECT), żadnych INSERT/UPDATE
// auto: domyślny, wykonuj bez pytania
```

**8c. mintRecordFactId** (wzorzec #28):

Tool bez parametrów → atomowo rezerwuje UUID → zwraca `fact_id`.
Cel: Oracle może równolegle uruchomić kilka sub-tasków z tym samym ID.

```typescript
// INSERT placeholder do vanguard_stream z status='processing'
// Zwróć { fact_id: uuid }
// Agent używa tego ID dla: karty + wiki + schedule
```

**8d. PendingToolImageBuffer** (wzorzec #6):

Gdy Oracle zwraca obraz (wykres, zdjęcie):
```typescript
// 1. Obraz zapisz w buforze per sessionId (in-memory w edge function)
// 2. Tool zwraca tylko tekst z opisem
// 3. Przed następnym LLM call → drain bufor → inject jako user message z obrazem
// Nigdy nie trzymaj base64 w history[].content
```

### Definition of Done
- [ ] Context compression działa (sprawdź w długich sesjach)
- [ ] AgentRunMode persystuje w user settings
- [ ] `confirm` mode wyświetla dialog przed mutacją
- [ ] `mintRecordFactId` tool działa atomowo
- [ ] `PendingToolImageBuffer` nie wrzuca base64 do historii
- [ ] `lessons.md` zaktualizowany

---

## DZIENNIK WYKONANIA

> Każdy agent dopisuje tutaj co zrobił. Format:
> `### Faza X — [Agent/Data]`
> Potem: co zrobiono, jakie pliki zmieniono, co zostało (jeśli nie wszystko), problemy.

### Faza 1 — Claude Sonnet 4.6 / 2026-06-23

**Co zrobiono:**
- `supabase/functions/vanguard-oracle/index.ts` — dodano sekcję `ROLA I ZASADY DZIAŁANIA (ORCHESTRATOR)` z 5 zasadami Orchestrator-style, sekcję `STYL ODPOWIEDZI — 8 MOVES` z companion moves (casual_continuation, emotional_witnessing, playful_banter, gentle_reflection, practical_help, celebration, protective_boundary, safety_escalation), sekcję `PAMIĘĆ — DEFAULT DENY` z allowlist i formatem atomowego faktu.
- `supabase/functions/vanguard-analyst/index.ts` — dodano sekcję `4 SOCZEWKI ANALIZY` (HIDDEN_CONTEXTS, ENERGY_TIDES, MICRO_CONSISTENCY, INTERACTIVE_CURIOSITY) wewnątrz system prompt Analista, między regułami a ZAKAZ.

**Pominięto (poza scope):**
- 1e Memory Summarize Prompt — Oracle nie kompresuje historii wewnętrznie w tym pliku; jeśli będzie potrzebne, zrobić w osobnej edge function lub dodać do reconciliation.

**Brak błędów.** Czyste zmiany — tylko stringi, zero logiki JS/TS.

---

## NOTATKI MIĘDZY AGENTAMI

> Jeśli coś odkryłeś co następny agent musi wiedzieć (zaskakujące zachowanie, coś co nie działało jak w planie, decyzja którą podjąłeś) — wpisz tutaj.

- Faza 2: Canvas variant GlassCard używa SVG data-URI jako background-image — NIE canvas element (zbyt ciężki). Dashed divider przez `repeating-linear-gradient`, nie border (border-style:dashed ma za mało kontroli nad rozmiarem).
- Faza 5: CardFactory lazy-importuje się w AiCardRenderer (dynamic import), żeby nie było circular dependency z OracleCard.
- Faza 6: ScheduleViewData persystuje w localStorage (klucz: vanguard_schedule_view), sweep uruchamia się on mount. Oracle mutacje schedule_mutation są pass-through — client aplikuje je do localStorage.
- Faza 7: knowledge_insight_cards tabela — Oracle zapisuje karty bezpośrednio przez Supabase client w edge function. InsightCard long-press threshold: 550ms.
- Faza 8: compressHistoryIfNeeded uruchamia się zawsze (softRatio=0.80 relative to 131,072 max tokens); historia slice(-10) przed kompresją. PendingToolImageBuffer to moduł-singleton in-memory w isolate — działa tylko w ramach jednego Deno isolate (nie persystuje między cold starts).
- AgentRunMode: getAgentRunMode() z localStorage, przekazywany jako agent_run_mode do Oracle; readOnly blokuje mutacje przez prompt.
