# MEMEX → VANGUARD: Kompletna lista wzorców do wdrożenia

> 371 plików Dart, 6 przejść. Wszystko co warte zabrania — z decyzją: wdrożyć czy olać i dlaczego.
> Stack Vanguard: React 19 + TS + Supabase (PostgreSQL + Auth + Edge Functions Deno) + DeepSeek + Telegram

---

## DECYZJA STRATEGICZNA

**NIE forkuj ich apki.** Powody:
- Memex = local-first (pliki YAML/markdown na urządzeniu, SQLite/Drift). Ty = cloud-first (Supabase). Nie da się „podpiąć bazy" — to przepisanie 60% kodu.
- Dart/Flutter → wyrzucasz React SPA + Vercel.
- Twoja wartość (Oura/Strava/strain engine/Oracle na realnych danych) nie istnieje u nich.

**Złotem Memex są wzorce i prompty, nie kod Dart.** Wszystkie są przenośne.

---

## PRIORYTETYZACJA WDROŻENIA (ROI malejąco)

| # | Feature | Czas | Trudność | Impact |
|---|---|---|---|---|
| 1 | ClarificationRequest system | 1-2 dni | średni | ⭐⭐⭐⭐⭐ |
| 2 | 13 widget schemas (wykresy) | 2-3 dni | średni | ⭐⭐⭐⭐⭐ |
| 3 | Magazine Bar (harmonogram) | 1-2 dni | niski | ⭐⭐⭐⭐ |
| 4 | MemoryAgent Default Deny | 0.5 dnia | niski | ⭐⭐⭐⭐ |
| 5 | Rolling context compression | 1 dzień | średni | ⭐⭐⭐⭐ |
| 6 | InsightAgent 4 lenses | 0.5 dnia | niski | ⭐⭐⭐⭐ |
| 7 | System action pending gate | 1 dzień | średni | ⭐⭐⭐ |
| 8 | 22 typy kart jako React komponenty | 3-4 dni | niski | ⭐⭐⭐ |
| 9 | Companion 8 moves | 0.5 dnia | niski | ⭐⭐⭐ |
| 10 | AgentSystemPromptHelper | 1 dzień | średni | ⭐⭐⭐ |
| 11 | PendingToolImageBuffer | 0.5 dnia | niski | ⭐⭐ |
| 12 | Streaming activity types | 1 dzień | średni | ⭐⭐ |
| 13 | PhotoSuggestion proactive | 1 dzień | średni | ⭐⭐ |

---

## CZĘŚĆ I: AI / AGENT WZORCE

---

### 1. ClarificationRequest System ⭐⭐⭐⭐⭐ [WDROŻYĆ]

**Co to:** Oracle może przerwać odpowiedź i zadać strukturalne pytanie zamiast zgadywać.

**4 typy odpowiedzi:**
- `confirm` → Yes/No
- `single_choice` → wybierz jedną opcję
- `multi_choice` → wybierz wiele opcji
- `short_text` → wpisz tekst

**Model danych:**
```typescript
interface ClarificationRequest {
  id: string
  fact_id: string           // karta/kontekst którego dotyczy pytanie
  dedupe_key: string        // nie duplikuj jeśli ten sam klucz
  question: string
  response_type: 'confirm' | 'single_choice' | 'multi_choice' | 'short_text'
  options: Array<{id: string, label: string, value: string}>
  evidence_fact_ids: string[]  // karty które doprowadziły do pytania
  proposed_memory: string?  // co Oracle chce zapamiętać po odpowiedzi
  confidence: number        // 0-1, jak pewny był Oracle bez pytania
  status: 'pending' | 'answered' | 'dismissed'
  answer?: {
    option_ids: string[]
    text: string
    is_custom_answer: boolean
    is_uncertain: boolean
  }
}
```

**UI auto-opcje zawsze dodawane:**
- `__uncertain__` — "Nie jestem pewny/a" (jeśli nie ma podobnej opcji)
- `__other__` — "Inna odpowiedź" → otwiera text input (auto-focus, zwija się jeśli pusty)

**Tool schema dla Oracle:**
```typescript
tool: create_clarification_request(
  question: string,
  response_type: string,
  options?: Array<{id, label, value}>,
  dedupe_key: string,
  evidence_fact_ids?: string[],
  proposed_memory?: string,
  confidence?: number
)
```

**Wdrożenie Vanguard:**
- Tabela `oracle_clarification_requests` w Supabase
- Tool w `vanguard-oracle` edge function
- React komponent w czacie Oracle (card z przyciskami)
- `answerRequest()` → zapisuje odpowiedź + triggeruje nową turę Oracle z kontekstem

---

### 2. InsightAgent — 4 Lenses ⭐⭐⭐⭐ [WDROŻYĆ — tylko prompt]

**Co to:** Przy analizie danych agent patrzy przez 4 wymiary zamiast jednego.

**4 lenses:**
```
1. Hidden Contexts     — co jest tłem/kontekstem co nie jest oczywiste?
2. Energy Tides        — kiedy energia/momentum jest wysoka vs niska?
3. Micro-Consistency   — co jest spójne między małymi zdarzeniami?
4. Interactive Curiosity — co byś chciał zbadać głębiej?
```

**Wdrożenie Vanguard:** Dodaj do `vanguard-analyst` (3am cron) i `vanguard-oracle` system prompt. Zero kodu — tylko zmiana promptu.

---

### 3. SuperAgent Orchestrator Zasady [WDROŻYĆ — tylko prompt]

Kluczowe zasady z ich `superAgentSystemPrompt`:

```
- "Orchestrator, not one-shot chatbot"
- "Smallest thing that fully serves intent" — nie rób więcej niż trzeba
- "Report only what tool results prove" — nigdy nie wymyślaj wyjaśnień dla błędów
- "Correct comprehensively, not one fragment" — jak naprawiasz, napraw wszystko
- "Never invent explanation for failure" — jeśli tool zawiedzie, powiedz to wprost
- Mint fact_id NAJPIERW → potem parallel workers (Card + PKM + Insight + Schedule)
- Parallel execution: emit multiple delegate_to_subagent calls in same turn
```

**Wdrożenie Vanguard:** Przepisać system prompt `vanguard-oracle` według tych zasad.

---

### 4. MemoryAgent — Default Deny Policy ⭐⭐⭐⭐ [WDROŻYĆ — tylko prompt]

**Zasada:** Domyślnie NIE zapisuj. Zapisuj tylko jeśli naprawdę trwałe.

**Zapisuj (allowlist):**
- Identity (imię, role, wiek)
- Strong Preferences (nie jednorazowe)
- Long-term Assets (projekty, narzędzia)
- Recurring Habits as patterns (nie jednorazowe zdarzenia)
- AI Interaction Preferences

**NIE zapisuj (blocklist):**
- Transient context ("pytał o X")
- One-off actions
- Already-known facts
- Tasks and todos
- Chat logs

**Memory format:** 3rd person, atomic facts
```
BAD: "User said he likes Python"
GOOD: "Preferred programming language: Python"
```

**Język:** zawsze taki sam jak input użytkownika.

**Wdrożenie Vanguard:** `vanguard_knowledge` table — ten prompt jako system dla procesu zapisywania.

---

### 5. Rolling Summary / Context Compression ⭐⭐⭐⭐ [WDROŻYĆ]

**Parametry:**
- `softRatio: 0.80` — przy 80% limitu tokenów → zacznij kompresję
- `hardRatio: 0.95` — przy 95% → wymuś kompresję
- `keepRecent: 20` — zachowaj ostatnie 20 wiadomości verbatim
- Budget: `12,000 char` dla skompresowanego podsumowania

**Pre-trim przed kompresją:**
1. Deduplikacja identycznych wiadomości
2. Truncate args narzędzi > 600 znaków
3. Truncate pojedynczych linii > 4000 znaków
4. Wytnij na bezpiecznej granicy (koniec turn, nie środek tool call)

**SuperAgentContextCompressor extra:** Po archiwizacji wiadomości → replace `ImagePart` z `[archived image attachment: fs://filename]` — nie trzymaj base64 w martwym archiwum.

**MemoryManagement prompt (konsolidacja):**
```
Role: Expert User Profile Builder
Rules:
1. Profiling over Logging (CRITICAL):
   - Convert Events to Attributes
   - BAD: "User asked about X on Monday" (Log)
   - GOOD: "Familiar with X" (Profile)
2. Aggressive Merging: 5 wpisów o tym samym → 1 bullet
3. Update Status: nowa info override stara
4. Discard Noise: timestamps, jednorazowe IDs, transient emotions
```

**Two-tier Memory:**
- `recent_buffer` (threshold=10) → po przekroczeniu: `_summarizeMemory()` → `archived_memory` (Markdown)
- Headers: Identity / Interests / Assets / Focus
- 7-Day Validity rule
- Auto-condense > 4000 chars → drugi LLM call → < 2000 chars

---

### 6. PendingToolImageBuffer — Obraz z tool result [WDROŻYĆ]

**Problem:** OpenAI-compat providers (w tym DeepSeek) odrzucają `ImagePart` w wyniku tool call — tylko tekst jest dozwolony.

**Rozwiązanie Memex:**
1. Tool zapisuje obraz w `PendingToolImageBuffer[sessionId]`
2. Tool zwraca tylko tekst
3. Przed następnym LLM call → `drain(sessionId)` → inject jako `UserMessage` z `ImagePart`
4. Obraz nie trafia do `state.history` — jednorazowy, nie bloatuje

**Wdrożenie Vanguard:** Przy zwracaniu zdjęć/wykresów z edge functions do Oracle.

---

### 7. AgentSystemPromptHelper — User-editable config [WDROŻYĆ]

Użytkownik może nadpisać prompty agentów przez pliki konfiguracyjne bez deployowania.

**Format pliku** `prompts/{agent_name}.conf`:
```
@@#CONF#[system_prompt:override]
...całkowity replacement...
@@#CONF#[/system_prompt:override]

@@#CONF#[system_prompt:replace]
@@#CONF#[old]tekst do zastąpienia@@#CONF#[/old]
@@#CONF#[new]nowy tekst@@#CONF#[/new]
@@#CONF#[/system_prompt:replace]

@@#CONF#[tool:tool_name]
{"description": "override", "parameters": {...}}
@@#CONF#[/tool:tool_name]
```

**Wdrożenie Vanguard:** JSON config w `vanguard_settings` lub osobna tabela. Pozwala dostroić Oracle bez edge function deploy.

---

### 8. ChatHistorySanitizer — Zapobiegaj loop detector FP

**Zasada:** NIGDY nie wstrzykuj `<system-reminder>` jako fake user/assistant turn pairs. To powoduje false positives w loop detectorze który zabija zdrowe sesje.

**Identyfikacja fake assistant message:** `model == "mocked"` → strip.

**Wdrożenie Vanguard:** Upewnij się że system remindery są injektowane jako system message, nie jako fake user/assistant turns.

---

### 9. Idle Skill Reminder — SuperAgentHarness [WDROŻYĆ]

**Mechanizm:**
- Śledź używane tools per skill per tura
- Po 3 turach gdzie skill aktywny ale żaden jego tool nie użyty → inject system reminder:
  > "These skills stayed active but unused for 3 turns: [skill_name]. Call deactivate_skills([...]) to keep context focused."
- Reminder auto-znika gdy model używa skill lub deaktywuje go

**PKM Health Reminder:**
- Gdy agent czyta plik PKM → sprawdź `PkmStatsService.getRecentEditCount()` (ostatnie 5 sesji)
- Jeśli plik był edytowany > X razy → inline reminder o reorganizacji

**PkmStatsService:** Przechowuje ostatnie 5 sesji edycji PKM. Identyfikuje "churned files" po liczbie edycji.

---

### 10. Quick Query Mode [WDROŻYĆ]

**Co to:** Tryb read-only dla Oracle który ma tylko narzędzia odczytu. Szybszy + tańszy.

**Dostępne tools w Quick Query:**
```
LS, Glob, Grep, Read, BatchRead, view_image
```

**Brak:** save_timeline_card, manage_pkm, file mutations, external APIs

**Wdrożenie Vanguard:** `Oracle(mode: 'quick')` → tylko query tools, bez możliwości zapisu do `vanguard_stream`.

---

### 11. delegate_to_subagent — Parallel Workers [WDROŻYĆ]

**Parametry:**
```typescript
delegate_to_subagent(
  skill: string,           // nazwa skill z registry
  task_brief: string,      // cel, nie procedura
  profile: 'none' | 'read' | 'full',
  skills: string[],        // force_activate
)
```

**Bezpieczeństwo:** File scope decydowany w kodzie (registry), nigdy przez model.
**Paralelizm:** Wiele wywołań w tej samej turze → równoległe wykonanie.
**Location/time:** Automatycznie injektowane przez runtime, nie przez model.

**Pattern SuperAgent:**
```
mintFactId()
→ parallel:
  - Card worker (save_timeline_card)
  - PKM worker (manage_pkm)
  - Insight worker (update_knowledge_insight)
  - Schedule worker (update_schedule_aggregation)
```

---

### 12. UserKnowledgeContextService — PKM w Oracle [WDROŻYĆ]

**Algorytm:**
1. Grep po słowach kluczowych z query → hits w plikach PKM
2. Fallback do FTS jeśli grep nie znajdzie
3. Max 5 kart, max 800 znaków/karta
4. Context radius: 240 znaków wokół match
5. Format: `<user_fact id="..." published_at="...">content</user_fact>`

**Wdrożenie Vanguard:** Oracle już ma `vanguard_knowledge` — podobny mechanizm dla `vanguard_wiki_pages`.

---

### 13. CharacterContextAssembler — 6-part context [WDROŻYĆ dla persona]

**6 warstw kontekstu per persona:**
```
userProfile        — profil użytkownika (MemoryManagement)
characterMemories  — co postać pamięta o użytkowniku
characterWorld     — triggered world entries (lore/settings)
recentTimeline     — ostatnie 20 zdarzeń (chat + komentarze)
checkpoints        — skompresowane podsumowania starszych zdarzeń
knowledgeCards     — PKM matches dla bieżącego query
```

**CharacterMemoryService pliki na disk per postać:**
```
character_memory/{characterId}/
  timeline.jsonl           — bieżące zdarzenia
  archived_timeline.jsonl  — zarchiwizowane
  indexes.json             — meta, migration_version, last_event_at
  checkpoints.jsonl        — compressed summaries
  memory_entries.jsonl     — trwała pamięć postaci
  world_entries.jsonl      — lore/world building entries
```

**CharacterContextCompressor:**
- `contextWindow: 64000`
- `softRatio: 0.80`, `hardRatio: 0.95`
- `keepRecent: 20`
- Failure cooldown: 10 min (nie próbuj kompresować jeśli ostatnio padło)
- `_findSafeBoundary()` — nigdy nie tnie w środku tury
- Po kompresji: `replaceCheckpoint()` → stare zdarzenia idą do archived

---

## CZĘŚĆ II: DATA MODELS

---

### 14. 22 Typy Kart Timeline ⭐⭐⭐ [WDROŻYĆ jako React komponenty]

**CardData model:**
```typescript
interface CardData {
  factId: string           // format: "2026/06/23.md#ts_5"
  timestamp: Date          // czas treści (nie czas zapisu)
  createdAt: Date          // czas systemowy zapisu
  status: 'processing' | 'active' | 'archived'
  tags: string[]
  uiConfigs: UIConfig[]
  title: string?
  fact: string             // surowa treść użytkownika — source of truth
  assets: Asset[]          // media: fs://filename.jpg
  comments: Comment[]      // threaded via replyToId
  insight: CardInsight?    // AI annotation
  userFixedLocation: Location?
}
```

**22 typy (5 kategorii):**

*Entities:*
- `link` — URL z preview (title, description, favicon, og:image)
- `person` — kontakt (name, role, avatar, contact info)
- `place` — lokacja (address, coords, type)
- `spec_sheet` — specyfikacja produktu/sprzętu (fields key-value)
- `transaction` — transakcja finansowa (amount, currency, category, merchant)

*Quantifiable:*
- `metric` — pomiar z wartością (value, unit, trend, target) — layout: 1 item row, 2+ items grid
- `rating` — ocena (score, max, label, category)
- `mood` — nastrój (emoji, label, score, context)
- `progress` — postęp w celu (current, target, label, deadline)

*Visual:*
- `canvas` — custom layout z dot grid painter (20px spacing, 15% opacity dots)
- `gallery` — galeria zdjęć
- `snapshot` — pojedyncze zdjęcie z kontekstem
- `video` — wideo z metadanymi

*Textual:*
- `article` — długi tekst z nagłówkiem
- `compact` — krótka notatka inline
- `conversation` — dialog (speaker A/B, timestamps)
- `insight_summary` — AI summary kart
- `quote` — cytat z autorem
- `snippet` — fragment kodu lub tekstu z podświetlaniem

*Temporal:*
- `duration` — zdarzenie z czasem trwania
- `event` — zdarzenie kalendarzowe
- `procedure` — lista kroków/instrukcja
- `routine` — powtarzające się zadanie

**System:**
- `schedule_briefing` — karta harmonogramu (hero_title, summary, items[])
- `task` — zadanie z subtasks[]

---

### 15. KnowledgeInsightCard Model [WDROŻYĆ]

```typescript
interface KnowledgeInsightCard {
  id: string
  templateId: string
  title: string
  insight: string          // AI analiza
  widgetType: 'native' | 'html'
  widgetTemplate: string?  // html template jeśli widgetType=html
  widgetData: object       // dane do template
  isPinned: boolean
  sortOrder: number
  relatedFactIds: string[]
  tags: string[]
}
```

**Narzędzia agenta:**
- `get_exists_knowledge_insight_cards()` → lista istniejących
- `save_knowledge_insight_cards(charts: ChartData[])` → batch save (type: 'add'|'update')
- `delete_knowledge_insight_card(id)`
- `delete_knowledge_insight_tags(tags[])`
- `get_available_templates()` → nativeWidgets list z description + promptStructure
- `get_user_activity_stats()` → UserStatsSnapshot

---

### 16. ScheduleViewData — Magazine Bar Model ⭐⭐⭐⭐ [WDROŻYĆ]

```typescript
interface ScheduleViewData {
  id: string
  generatedAt: Date
  timeRange: { start: Date, end: Date }
  hero: ScheduleViewHero?
  editorialIntro: string    // krótki przegląd tygodnia
  quoteBlocks: QuoteBlock[] // max 2
  timeline: ScheduleViewTimelineDay[]
  completed: CompletedItem[]
}

interface ScheduleViewHero {
  cardId: string
  title: string
  description: string?
  startTime: Date?
  endTime: Date?
  location: string?
  priority: number
}

interface QuoteBlock {
  title: string
  content: string
  priority: 'low' | 'normal' | 'high'
  relatedCardId: string?
}

interface ScheduleViewTimelineDay {
  dayLabel: string          // "TODAY", "TOMORROW", "MON JUN 23"
  dayDate: string           // "2026-06-23"
  items: ScheduleItem[]
}
```

**Hero zasada:** Najbardziej znaczące zdarzenie, NIE następne chronologicznie.

**ScheduleAggregationSkill tools:**
```typescript
get_schedule_state()
add_pending_item(kind, title, source_fact_id, start_time?, due_at?, sync_device_action?)
update_pending_item(id, ...)
complete_pending_item(id)
complete_subtask(item_id, subtask_title, completed)
set_presentation(hero?, editorial_intro?, quote_blocks[]?, timeline_days[])
search_completed(query)
```

`dedupeBySourceFactId` w metadata — zapobiega duplikatom przy re-trigger.
`sweepPastEventsInState()` — czysta funkcja auto-complete eventów po `pastAfter`.

---

### 17. UserStatsSnapshot Model [WDROŻYĆ]

```typescript
interface UserStatsSnapshot {
  // 6 metryk wejść
  totalInputs: number
  totalWords: number
  totalCards: number
  totalKnowledgeUnits: number
  totalInsights: number
  totalCompletedTodos: number
  
  // totalOutputs = totalCards + totalKnowledgeUnits + totalInsights + totalCompletedTodos
  totalOutputs: number
  
  activeDays: number
  currentStreakDays: number
  
  // Trend (auto: bucket=7 jeśli range >= 90 dni, else bucket=1)
  trend: UserStatsTrendBucket[]
  
  // Breakdown per source
  sourceBreakdown: {
    text: number
    image: number
    audio: number
  }
  
  // Dzienne punkty (do wykresu)
  dailyPoints: UserStatsDailyPoint[]
}
```

---

### 18. AgentRunSnapshot — Progress Tracking [WDROŻYĆ]

```typescript
interface AgentRunSnapshot {
  id: string
  userId: string
  factId: string
  state: 'queued' | 'running' | 'pausedBySystem' | 'completed' | 'failed'
  stage: string             // opis bieżącego etapu, np. "Analyzing cards"
  message: string?
  completedUnits: number
  totalUnits: number
  remainingTasks: number
  currentTaskId: string?
  currentTaskType: string?
  lastError: string?
  updatedAt: Date
}
// isVisible = state ∈ {queued, running, pausedBySystem, failed}
```

**AgentActivityType — 11 typów streamu:**
```typescript
enum AgentActivityType {
  agent_start, agent_stop,
  tool_call_request, tool_call_response,
  thought, info, error, warn, plan,
  thought_chunk, output_chunk      // streaming — bufferowane per agentId
}
```

---

### 19. CharacterModel — Persona [WDROŻYĆ dla per-context Oracle]

```typescript
interface CharacterModel {
  id: string
  name: string
  persona: string                  // opis osobowości
  systemPromptOverride: string?    // najwyższy priorytet
  postHistoryInstructions: string? // appended po historii
  mesExample: string?              // przykładowe dialogi
  interestFilter: string?          // filtr zainteresowań
  firstMessage: string?            // initial greeting
  memory: CharacterMemoryBlock[]   // {label, value, description}
  isPrimaryCompanion: boolean
}
```

**Import:** z JSON lub PNG (PNG embeduje character card w EXIF metadata). Conflict detection po nazwie.

---

### 20. AgentDefinitions — 4 agenty z osobnymi LLM [WDROŻYĆ]

```typescript
const AgentDefinitions = {
  chat_agent: {...},        // główny chat
  comment_agent: {...},     // komentarze do kart
  companion_agent: {...},   // persona/character chat
  profile_agent: {...},     // zarządzanie pamięcią
}
// Każdy agent ma własny LLM config (provider, model, temperature, maxTokens)
```

**15+ providerów LLM w LLMConfig:**
`chatCompletion, responses, claude, bedrockClaude, gemini, geminiOauth, kimi, qwen, seed, zhipu, deepSeek, minimax, openRouter, ollama, mimo, memex`

---

## CZĘŚĆ III: 13 NATYWNYCH WIDGET SCHEMAS

> Gotowe TypeScript interfaces do wklejenia w prompt Oracle. Wdrożyć jako React komponenty.

---

### Schemat bazowy (wszystkie widgety):
```typescript
interface ChartData {
  id?: string
  templateId: string
  title?: string
  insight?: string          // AI analiza nad danymi
  type?: 'add' | 'update'
  data: object              // per-template schema poniżej
  relatedFacts?: string[]
  pinned?: boolean
  sortOrder?: number
  tags?: string[]
}
```

---

### map_card_v1 — Mapa z lokacjami
```typescript
interface MapCardData {
  locations: Array<{lat: number, lng: number, name: string}>
  infoTitle?: string
  infoDetail?: string
  ext_html?: string         // dodatkowy HTML na stronie szczegółów
}
// Walidacja: locations required, min 1 punkt
```

### route_map_card_v1 — Trasa/szlak
```typescript
interface RouteMapCardData {
  locations: Array<{lat: number, lng: number, name: string}>
  ext_html?: string
}
// Walidacja: min 2 punkty
```

### highlight_card_v1 — Cytaty, kluczowe wnioski
```typescript
interface HighlightCardData {
  quote_content: string
  quote_highlight?: string  // słowa kluczowe do podświetlenia
  footer?: string
  theme?: 'primary' | 'orange' | 'blue'
  date?: string
}
```

### composition_card_v1 — Procentowy podział
```typescript
interface CompositionCardData {
  badge?: string
  headline_items?: Array<{text: string, color?: string}>
  items: Array<{label: string, percentage: number, color?: string}>
  footer?: string
}
// color: hex #RRGGBB lub #RRGGBBAA
```

### contrast_card_v1 — Problem vs Rozwiązanie, Wtedy vs Teraz
```typescript
interface ContrastCardData {
  emotion?: 'negative' | 'neutral' | 'positive'
  context_section: {content: string, source?: string}
  highlight_section: {title?: string, content: string, highlight?: string}
}
```

### gallery_card_v1 — Galeria porównawcza
```typescript
interface GalleryCardData {
  headline?: string
  images: Array<{url: string, label?: string}>  // url: fs://filename.jpg
  content?: string
}
```

### bubble_chart_card_v1 — Rozkład tematów/słów kluczowych
```typescript
interface BubbleChartCardData {
  bubbles: Array<{
    label: string
    value: number           // 1-100, kontroluje rozmiar
    color?: string
    sub_label?: string
    is_highlight?: boolean  // wycentrowane, największe
  }>
  footer?: string
}
```

### progress_chart_card_v1 — Ring progress / cel
```typescript
interface ProgressChartCardData {
  subtitle?: string         // np. "12 books left"
  current: number
  target: number            // jeśli current jest %, target = 100
  center_text?: string
  items: Array<{label: string, value: number, color?: string}>
}
```

### radar_chart_card_v1 — Multi-wymiarowy balans
```typescript
interface RadarChartCardData {
  badge?: string            // np. "Focus this month"
  center_value?: string
  center_label?: string
  dimensions: Array<{label: string, value: number, max: number}>
  color?: string
}
// Walidacja: min 3 dimensions
```

### trend_chart_card_v1 — Trend czasowy
```typescript
interface TrendChartCardData {
  top_right_text?: string   // np. "Avg: 7.2"
  points: Array<{label: string, value: number, is_highlight?: boolean}>
  highlight_info?: {title?: string, subtitle?: string}
  color?: string
}
// Walidacja: min 2 punkty
```

### bar_chart_card_v1 — Porównanie kategorii
```typescript
interface BarChartCardData {
  subtitle?: string
  unit?: string
  items: Array<{
    label: string
    value: number
    icon?: string           // emoji lub URL
    color?: string
    is_highlight?: boolean
  }>
}
```

### timeline_card_v1 — Przepływ zdarzeń w czasie
```typescript
interface TimelineCardData {
  items: Array<{
    time: string            // np. "09:00"
    title?: string
    content?: string
    icon?: string           // emoji lub asset
    color?: string
    is_filled_dot?: boolean // ring vs solid dot
  }>
}
```

### summary_card_v1 — Tygodniowy/dzienny raport
```typescript
interface SummaryCardData {
  tag?: string              // np. "WEEKLY REVIEW"
  date?: string             // zakres dat
  badge?: {icon?: string, text?: string}
  insight_title?: string    // default "Agent Insight"
  metrics?: Array<{label: string, value: string | number, color?: string}>
  highlights_title?: string
  highlights?: Array<{url: string, label?: string}>
}
```

---

## CZĘŚĆ IV: UI PATTERNS

---

### 21. Design System ⭐⭐⭐ [INSPIRACJA]

```css
/* Kolory */
--primary: #5B6CFF
--background: #F7F8FA
--card: #FFFFFF
--text-primary: #0A0A0A
--text-secondary: #4A5565
--text-tertiary: #99A1AF
--success: #10B981
--warning: #F59E0B
--danger: #F43F5E

/* Avatar gradient: 12 stops #5B6CFF → #7B8AFF */

/* Cienie */
--shadow-card: 0 2px 16px rgba(0,0,0,0.05)
--shadow-float: 0 6px 24px rgba(0,0,0,0.08)

/* Karta */
border-radius: 20px
font-family: "Bricolage Grotesque" weight 800 (brand), system-ui (body)
```

---

### 22. 5 Wariantów Kart [WDROŻYĆ]

| Wariant | Tło | Radius | Cień | Użycie |
|---|---|---|---|---|
| `glass` | biały | 20 | card shadow | domyślny |
| `immersive` | gradient `#0A0A0A` | 24 | float shadow | hero content |
| `canvas` | biały + dot grid 20px spacing 15% | 20 | card shadow | custom layout |
| `receipt` | biały + tertiary border 20% | 24 | brak | transakcje |
| `outline` | transparent + tertiary border 30% | 24 | brak | draft/disabled |

---

### 23. Magazine Hero Card — Exact Design ⭐⭐⭐⭐ [WDROŻYĆ]

```css
/* Hero Container */
background: linear-gradient(135deg, #172554, #0F766E);
border-radius: 16px;
min-height: 188px;
border: 1px solid rgba(255,255,255,0.08);

/* "FEATURED" Badge */
background: rgba(255,255,255,0.15);
border-radius: 8px;
padding: 4px 10px;
font-size: 10px; font-weight: 600; letter-spacing: 1px;
color: rgba(255,255,255,0.9);
text-transform: uppercase;

/* Title */
font-size: 21px; font-weight: 700; line-height: 1.2; letter-spacing: 0;
color: #FFFFFF;

/* Meta row (icon + text) */
icon: 14px, color rgba(255,255,255,0.6)
text: 13px, color rgba(255,255,255,0.6)
```

---

### 24. Dynamic Timeline UI — HTML Templates [WDROŻYĆ]

**Zasady tworzenia custom templates:**
- Placeholders: `{{variable_name}}`
- Typy pól: tylko `String | Number | Boolean`
- ZAKAZ: JS, iframes, external scripts, network calls
- Mobile-first, inline CSS
- Outermost element: BEZ border-radius
- Workflow: `recommend_patterns` → `preview_render` → `save`

**6 Design Pattern Library wzorców:**
| Wzorzec | Słowa kluczowe |
|---|---|
| `visual_memory_editorial` | memory, photo, day, moment |
| `work_progress_command` | project, task, deadline, sprint |
| `personal_review_magazine` | weekly, review, reflection, recap |
| `metric_signal_dashboard` | metric, data, number, tracking |
| `decision_studio` | decision, choice, comparison, pros cons |
| `system_action_receipt` | action, confirmation, receipt, log |

---

### 25. RadialMenu — Hold-to-Record UI [INSPIRACJA]

- Hold → radial menu pojawia się z `elasticOut` animacją (300ms)
- Waveform: 8 pasków, `height = 8 + |sin(i*0.8 + t*2π) * 12|`, kolor primary 80%
- Cancel button: curved arc (`CustomPainter.drawArc`), sweep = `width/radius`, rotuje na pozycję góra
- Transcript: auto-scroll do dołu przy każdym nowym tekście
- Hover detection: proximity 60px, `HapticFeedback.selectionClick()` przy wejściu na opcję
- `isCalibrating` → spinner + "Transcribing..." zamiast waveform

---

### 26. AssetHeaderGallery — Swipeable Image Header [WDROŻYĆ]

- `PageController` dla swipe galerii
- `InteractiveViewer` z `TransformationController` dla pinch-to-zoom
- Zoom detection: `scale > 1.01` → blokuj parent scroll
- Pointer count tracking: `> 1` (multi-touch) → blokuj scroll
- `SliverAppBar` pull-to-expand na stronie szczegółów

---

## CZĘŚĆ V: INFRASTRUKTURA AGENTÓW

---

### 27. System Action — Pending → User Approve [WDROŻYĆ]

**Pattern:** Agent proponuje → user zatwierdza → native wykonuje.

```typescript
// Agent tworzy:
{
  type: 'calendar_event' | 'reminder',
  status: 'pending',
  payload: {
    title, startTime, endTime?, location?, notes?  // calendar
    title, dueDate?, notes?                         // reminder
  }
}
```

**Po zatwierdzeniu:** Native channel → Google Calendar API / Reminders.

**Wdrożenie Vanguard:** `oracle_pending_actions` tabela. Oracle może zaproponować "Czy dodać do kalendarza?" i poczekać na odpowiedź.

---

### 28. mintRecordFactId — Atomowe rezerwowanie ID [WDROŻYĆ]

**Problem:** Bez pre-alokacji agent może zgadywać ID i kolizja.

**Rozwiązanie:**
1. Agent wywołuje `mintRecordFactId()` → ZERO parametrów
2. System pisze placeholder card atomowo → zwraca `fact_id`
3. Agent używa tego ID dla: karty + PKM comment (`<!-- fact_id: X -->`) + schedule

**Format:** `2026/06/23.md#ts_5`

**Wdrożenie Vanguard:** `vanguard-oracle` tool który generuje UUID i wstawia placeholder do odpowiedniej tabeli.

---

### 29. FTS5 + Jieba — Full Text Search [WDROŻYĆ JEŚLI POTRZEBA]

**Architektura:**
```
FileOperationService (mutation) 
  → callback → SearchService
  → DataChangeRecord → GlobalEventBus
  → EventTaskSubscription → LocalTaskExecutor
  → fts_index_handler → SearchDao (FTS5 SQLite)
```

**Post-migration:** full rebuild flag w DB → przy pierwszym starcie po migracji triggeruje tło rebuild.
**Jieba:** CJK segmenter, lazy init, auto-release po idle.

**Wdrożenie Vanguard:** Supabase ma wbudowany FTS (`tsvector`). Jieba niepotrzebne. Wzorzec event-driven index update wartościowy.

---

### 30. EventBus — Wewnętrzny pubsub [WDROŻYĆ]

**Pattern:** Centralna szyna eventów dla UI refresh bez prop drilling.

**Kluczowe eventy Memex:**
- `scheduleAggregationUpdated` → reload Schedule view
- `cardDetailUpdated` → refresh karta detail
- `attachmentsChanged` → refresh Action Center badge
- `personaChatMessageAdded` → reload persona chat

**Wdrożenie Vanguard:** Supabase Realtime (`postgres_changes`) + React context/zustand dla local events.

---

### 31. LocalTaskExecutor — Persistent Task Queue [WDROŻYĆ JEŚLI POTRZEBA]

```typescript
// Polityki współbieżności
TaskConcurrencyPolicy.byUser() // = jedno zadanie danego typu per user

// TaskActivitySnapshot
{ pending: number, processing: number, retrying: number, activeTaskIds: Set<string> }

// TaskQueueOwnerKind
'foreground' | 'background'
```

Zadania w SQLite — przeżywają kill apki. Foreground vs background owner — ten sam task może przejąć background worker.

**Wdrożenie Vanguard:** Supabase Edge Functions + pg_cron zastępują to w pełni.

---

### 32. AgentBackgroundCoordinator — Lifecycle [WDROŻYĆ JEŚLI MOBILE]

- App lifecycle observer (resumed/paused/detached)
- Kiedy app do tła → schedule background drain via Workmanager
- Kiedy agent kończy w tle → push notification

**Wdrożenie Vanguard:** Telegram bot eliminuje potrzebę tego w Vanguard (background już działa przez Supabase cron).

---

### 33. PhotoSuggestion — Proaktywne surfacing [WDROŻYĆ JEŚLI MOBILE]

- `PublishTimestampService.getQueryTimestamp()` = `max(last_publish, 24h_ago)`
- Max 5 nowych zdjęć per surfacing
- MLKit: OCR + image labeling na sugerowanych zdjęciach
- Android 13+: `READ_MEDIA_IMAGES` vs starsze: `READ_EXTERNAL_STORAGE`

**Wdrożenie Vanguard:** Nie dotyczy (brak mobile app). Wzorzec query timestamp przydatny.

---

## CZĘŚĆ VI: PROMPT ENGINEERING — GOTOWE WZORCE

---

### 34. Companion Agent — 8 Moves [WDROŻYĆ — tylko prompt]

```
1. casual_continuation    — naturalna kontynuacja rozmowy
2. emotional_witnessing   — bycie z emocją bez rad
3. playful_banter         — żartobliwa wymiana
4. gentle_reflection      — ostrożne pytanie zwrotne
5. practical_help         — konkretna pomoc
6. celebration            — świętowanie sukcesów
7. protective_boundary    — łagodne postawienie granic
8. safety_escalation      — eskalacja gdy zagrożenie
```

**Zasady:**
- Max 2 moves per odpowiedź
- NIE kończ każdej odpowiedzi pytaniem
- Wspieraj, nie kieruj
- Język = język użytkownika

---

### 35. Comment Agent — SaveComment vs SkipComment [WDROŻYĆ — tylko prompt]

```
SaveComment(content, reply_to_id?) → stopFlag=true
SkipComment(reason) → stopFlag=true

8 moves komentarza:
1. witness          — bycie z treścią
2. protect          — ochrona granicy
3. tease            — żartobliwy komentarz
4. celebrate        — świętowanie
5. sit_with         — milczące towarzyszenie
6. poetic_echo      — poetyckie odbicie
7. practical_nudge  — praktyczna wskazówka
8. safety_boundary  — granica bezpieczeństwa
```

`systemPromptOverride` w CharacterModel → najwyższy priorytet (override wszystkiego).

`CharacterMemoryEventType`:
```
userChatMessage, characterChatMessage, postObserved,
characterComment, userCommentReply, characterActionMessage
```

---

### 36. SendActionMessage Tool — Narrative Descriptions [WDROŻYĆ]

**Co to:** Agent może wysyłać stage directions (*leans closer and whispers*) — oddzielna wiadomość, nie bubble, italic, wycentrowana.

```typescript
tool: SendActionMessage(action: string)
// Automatycznie owija w *asterisks* jeśli nie owiniete
// Renderuje jako centered italic line between chat bubbles
// NIE wkładaj dialogue lub spoken words w ten tool
```

---

### 37. Memory Summarize Prompt — Profiling over Logging [WDROŻYĆ]

Gotowy prompt do wklejenia:
```
Role: Expert User Profile Builder
Task: Synthesize short-term memories into a cohesive User Profile.

Rules (STRICT):
1. Convert Events to Attributes:
   BAD: "User asked about OpenWrt settings on Monday" → This is a Log
   GOOD: "Tech Stack: Familiar with OpenWrt & Network configuration" → This is a Profile

2. Aggressive Merging:
   - 5 entries about "Router setup" → ONE bullet defining network setup
   - New info contradicts old → OVERWRITE, keep latest state
   - Discard specific timestamps, one-off IDs, transient emotions

3. Language Consistency: same as user input

Output format: Markdown with headers (Identity / Interests / Assets / Focus)
Max: 2000 chars
```

---

### 38. P.A.R.A. PKM Structure [WDROŻYĆ]

```
/PKM
  /Projects    — aktywne projekty z deadline
  /Areas       — obszary odpowiedzialności (health, work, finance)
  /Resources   — referencje, wiedza, notatki
  /Archives    — zakończone projekty
```

`skip_pkm_organization(evidence)` tool → agent może pominąć jeśli treść to nie wiedza (np. codzienne zdarzenie bez wartości PKM). `stopFlag=true`.

`update_timeline_card_insight(fact_id, insight_text, related_fact_ids[])` — waliduje że karta istnieje przed zapisem, dropuje self-references i nieistniejące `related_fact_ids`.

---

### 39. AgentRunMode [WDROŻYĆ]

```typescript
enum AgentRunMode {
  auto,      // wykonaj bez pytania
  confirm,   // pytaj przed mutacjami (gateMutatingToolCall)
  readOnly,  // tylko read tools
}
```

`gateMutatingToolCall(toolName, summary, details)` — przy `confirm` mode → wyświetla użytkownikowi co agent chce zrobić i czeka na akceptację.

---

### 40. EventLog Tool — Search Workspace Events [WDROŻYĆ]

```typescript
tool: search_workspace_event_logs(
  from_time: string,     // ISO 8601, required
  to_time?: string,      // ISO 8601
  limit?: number,        // max 200
  offset?: number,       // pagination
)
// Returns: chronological events: {event_type, description, local_time, file_path, metadata}
```

**Wdrożenie Vanguard:** `vanguard_stream` table + search edge function. Już prawie istnieje.

---

## CZĘŚĆ VII: DODATKOWE WZORCE

---

### 41. StreamingTranscriber — Confirmed/Pending Model [INSPIRACJA]

```
confirmed (frozen) | pending (mutable)
                    ↑ calibration replaces here
```

VAD (Silero ONNX, offline): threshold=0.45, minSilence=0.4s, maxSpeech=5s, minSpeech=0.25s
Kalibracja: gdy pending ≥ 6s i ≥ 2 segmenty → re-transkrybuj razem, wynik do confirmed.
Nowe segmenty podczas kalibracji są bezpieczne — lądują za snapshot.

**Wdrożenie Vanguard:** Wzorzec confirmed/pending przy real-time transkrypcji głosu.

---

### 42. FileToolFactory — 10 tools security model [INSPIRACJA]

```typescript
// Narzędzia
Read, BatchRead, Write, Edit, Move, Remove, LS, Glob, Grep, view_image

// view_image: fs://filename → WebP compress 2048px quality 85 + EXIF context injection
// Grep: case-insensitive default
// Mutating tools (Write/Edit/Move/Remove): gated przez gateMutatingToolCall()
// File scope: decydowany w kodzie (writeRoots per skill), NIGDY przez model
```

---

### 43. Location Context Service [INSPIRACJA]

- GPS-only, NO IP fallback ("proxy/VPN makes it misleading")
- High accuracy, 6s timeout
- Reverse geocode z 4s timeout
- Cache TTL: fresh+address = configurable, fresh+no_address = 2min, stale = 2min
- Last known position: max 2min stale

---

### 44. Backup Service [INFORMACYJNIE]

```typescript
// Format: .memex (custom archive)
// Auto-backup: co 24h
// Safety backup: przed każdym importem
// Bez kompresji dla: .jpg, .png, .mp4, .mp3, .pdf, .webp (16 typów)
// threshold bez kompresji: 16MB
// Manifest: manifest.json wewnątrz archiwum
// Schema version: 1
```

---

### 45. ScheduleStateSweeper — Auto-Complete [WDROŻYĆ]

Czysta funkcja — przenosi `pending` events których `pastAfter` minął do `completed`:
```typescript
function sweepPastEventsInState(state, now) {
  const nowMillis = now.getTime()
  const [stillPending, newlyCompleted] = partition(state.pending, item =>
    item.isEvent && item.pastAfter && nowMillis >= item.pastAfter.getTime()
  )
  return { ...state, pending: stillPending, completed: [...state.completed, ...newlyCompleted].sort(desc) }
}
```

---

### 46. SuperAgent Quick Query Mode + Tool Security [WDROŻYĆ]

**Quick Query:** `readOnly + {LS, Glob, Grep, Read, BatchRead, view_image}`

**Skill registry security pattern:**
```typescript
// Bezpieczne mapowanie skill → (build, readRoots, writeRoots)
// File scope = kod, NIE model
// Parallel execution = multiple delegate calls in one turn
// task_brief = goal not procedure
```

---

## CZĘŚĆ VIII: UI ANIMATIONS & DETAILED COMPONENTS (nowe — 6. przejście)

---

### 47. Typography Scale — Dokładne wartości [WDROŻYĆ]

Font stack z `AppTextStyles`:

```css
/* Brand */
brandTitle: Bricolage Grotesque 32px w800 letterSpacing -0.41 height 22/32

/* Cards */
cardTitle: PingFang SC 24px w600 height 33/24 letterSpacing -0.45 textPrimary
cardListTitle: 20px w600 height 23/20 letterSpacing -0.45 textPrimary

/* Data metric */
data: 24px w800 height 1.0 letterSpacing -1.0  /* wielkie liczby */

/* Body */
body: 15px w400 height 1.6
small: 13px w500 height 1.4

/* Meta */
tag: PingFang SC 16px w400 primary color
timestampHeader: 12px w500 height 20/12 letterSpacing -0.15 textTertiary
sectionTitle: 15px w500 letterSpacing -0.15 textSecondary
filterTabLabel: 14px w500 letterSpacing -0.15
aiGeneratedLabel: 10px w400 primary color

/* Comments */
commentName: 16px w500 height 20/16 letterSpacing -0.15
commentContent: 14px w400 height 20/14 textSecondary
commentDate: 14px w400 height 20/14 textTertiary
```

---

### 48. Shadow System — 5 Named Shadows [WDROŻYĆ]

```css
/* card — standard elevation */
box-shadow: 0 2px 16px rgba(0,0,0,0.05);

/* cardAccent — snapshot/event */
box-shadow: 0 0 24px rgba(17,24,39,0.05);

/* eventCard — calendar events */
box-shadow: 0 0 18px rgba(17,24,39,0.03);

/* backButton — floating buttons */
box-shadow: 0 0 9px rgba(0,0,0,0.04);

/* floating — FAB, bottom sheets, overlays */
box-shadow: 0 6px 24px rgba(0,0,0,0.08);
```

---

### 49. AICoreButton Animation — Bounce on Tap [WDROŻYĆ]

Centralny przycisk AI (88×88px, circular):

```typescript
// AnimationController — scale
duration: 150ms
lowerBound: 0.9, upperBound: 1.0, initialValue: 1.0

// Tap sequence
onTap → animateTo(0.9) → then animateTo(1.0) → callback

// Visual
shape: circle, shadow: rgba(91,108,255,0.15) blurRadius 6 spreadRadius -2 offset (0,3)
// SVG icon 88×88 (circle 68px + 10px shadow padding each side)

// Long press — direct (no animation)
onLongPressStart → callback immediately
```

---

### 50. AgentChatDialog — Slide-Up Animation [WDROŻYĆ]

Bottom sheet chat z animacjami:

```typescript
// Slide-up + fade on open
AnimationController duration: 500ms
slideAnimation: Offset(0,1) → Offset.zero  curve: Curves.easeOutCubic
fadeAnimation: 0 → 1  curve: Curves.easeOut

// Geometry
height: 75% viewport (isFullScreen: 100%)
borderRadius: vertical top Radius.circular(32) (isFullScreen: BorderRadius.zero)

// Keyboard handling
onKeyboardShow: duration 220ms
onKeyboardHide: duration 0ms (instant)
availableHeight = screenHeight - keyboardInset
finalHeight = min(baseHeight, availableHeight)

// Time divider format
same day: "HH:mm"
yesterday: "Yesterday HH:mm"
< 7 days: "Mon HH:mm"
same year: "Jun 23 HH:mm"
other year: "Jun 23, 2025 HH:mm"
```

---

### 51. Chat Message Types — Display Hierarchy [WDROŻYĆ]

```typescript
// Typy wiadomości w czacie agenta
UserMessageItem    { text, refs[], imagePaths[] }
AIMessageItem      { text, isStreaming }
ThinkingItem       { text, isExpanded, isFinished }  // reasoning collapsible
ToolCallItem       {
  id, toolName, args, result, isError, isExpanded,
  label?, status?,
  startedAt, completedAt, duration?,
  childToolCalls: ToolCallItem[],   // drzewo nested calls
  metadata?: { dedupeBySourceFactId?, ... }
}
ErrorItem          { error, timestamp }
ArtifactItem       { artifact: ChatArtifact, html?: string }
ApprovalRequestItem { request, status: 'pending'|'approved'|'denied' }
ProcessItem        {                    // grupuje jeden "turn" agenta
  children: ChatDisplayItem[],
  toolCalls, allTraceCalls, thinkingItems,
  hasRunningTool, hasToolError,
  isExpanded, isFinished
}
```

---

### 52. ActionCenterSheet — Pending Attachments [WDROŻYĆ]

Bottom sheet z pending items (od agenta, przed potwierdzeniem):

```typescript
// Animacja: fade-in gdy items załadowane
AnimationController duration: 300ms, Curves.easeOut
FadeTransition po załadowaniu items

// EventBus subscriptions
attachmentsChanged → _load()
cardUpdated → _load()

// Licznik per typ
countByType(): Map<string, int>  // 'systemAction', 'clarificationRequest', etc.
```

---

### 53. ClipboardPreviewCard — Wykrywanie Schowka [WDROŻYĆ]

Floating card gdy jest co wkleić:

```css
/* Container */
background: white; border-radius: 20px;
border: 1px solid primary(14%);
box-shadow: 0 10px 24px rgba(0,0,0,0.08);
padding: 14px 12px 12px 14px;

/* Icon container */
width: 28px; height: 28px; border-radius: 14px;
background: primary(10%);

/* "Unprocessed" badge — top right */
background: success(10%); border-radius: 99px; padding: 4px 8px;
font: 11px w700 success color;

/* Preview text */
13px h=1.45 w500 textSecondary; maxLines: 3;

/* Paste button */
background: black; color: white; border-radius: 14px; padding: 11px vertical;
font: 13px w700;

/* Dismiss button */
background: #F7F8FA; size: 42×42;
```

---

### 54. PersonaAvatarButton — Avatar z Unread Badge [WDROŻYĆ]

Przycisk otwierający chat z personą (36×36px w nav):

```css
/* Frame */
width: 36px; height: 36px; border-radius: 13px;
background: primary;
box-shadow: 0 4px 10px primary(18%);

/* Forum icon */
Icons.forum_rounded; size: 19px; color: white; centered;

/* Character avatar chip */
position: bottom-left offset(-3px, -3px);
size: 18×18px; padding: 1.5px; background: white; border-radius: 50%;
border: 1px solid primary(18%);
CharacterAvatar inside: 15px

/* Online dot */
position: bottom-right (right:4, bottom:4);
size: 4×4px; background: white(82%); border-radius: 50%;

/* Unread badge */
position: top-right offset(-3px, -2px);
background: red; border-radius: 8px; padding: 0 4px; min: 16×16px;
border: 1px solid white;
font: 10px w600 white; truncate at 99+;
```

---

### 55. DemoOverlay — Spotlight Onboarding [INSPIRACJA]

Spotlight overlay do tutorialu:

```typescript
// Cutout + scrim
_SpotlightPainter: CustomPainter
  path = fullRect - RRect (evenOdd fill)
  glow border: primary(40%) 2px stroke

// Cutout padding: inflate targetRect by 8px
// Tooltip: 280px wide, above or below based on center.dy > height/2

// Timing delays (guard mid-animation)
sendButton: 400ms
firstCard: 500ms
default: 350ms

// Double-measure stability check
measure #1 → wait 150ms → measure #2 → if diff < 2px → commit

// Welcome/Done modal
BackdropFilter blur(10, 10) + white(92%) + primary(20%) border
radius: 24px, padding: 32px
```

---

### 56. SharePosterDecorator — Export/Share Card [WDROŻYĆ]

Wrapper do share-card export:

```css
/* Background */
background: linear-gradient(top→bottom, #F7F8FA, #E2E8F0);
padding: 24px 40px 32px 24px;

/* Content container */
background: white; border-radius: 24px;
box-shadow: 0 12px 24px rgba(0,0,0,0.04), 0 20px 40px rgba(99,102,241,0.03);

/* Brand gradient text (ShaderMask) */
gradient: linear-gradient(topLeft→bottomRight, #6366F1, #A855F7, #EC4899)
font: 22px w900 letterSpacing -0.5

/* Tagline */
font: 12px w500 color #64748B letterSpacing 0.2
```

---

### 57. UserStatsOverviewCard — Activity Mini-Dashboard [WDROŻYĆ]

Karta statystyk aktywności:

```typescript
// Layout
CardContainer: white, radius 12, border #E5E7EB, shadow 0 4px 12px rgba(0,0,0,0.04)

// Header
icon: query_stats_rounded 18px success(59) w/ success(10%) bg radius 8

// 3 MetricPills (row)
MetricPill {
  label: Records | Cards | CompletedTodos
  color: primary | success | warning
  valueStyle: 17px w800 color
  labelStyle: 11px #6B7280
  bg: color(8%) radius 8
}

// MiniBarChart (42px height)
barHeight = 8 + (value/max * 30)
barColor = value > 0 ? primary(75%) : #E5E7EB
barRadius = 4

// Loading skeleton
grey (#E5E7EB) rounded rects at same positions
```

---

### 58. Insight Action Overlay — Long-Press Context Menu [WDROŻYĆ]

```css
/* Scrim */
background: rgba(0,0,0,0.6); Positioned.fill;

/* Sort button */
background: #F59E0B; shape: circle; padding: 16px;
box-shadow: rgba(F59E0B, 30%) blurRadius 12 spreadRadius 2;

/* Delete button */
background: #EF4444; same structure;
(loading state: white CircularProgressIndicator 2px strokeWidth)

/* Cancel X */
position: top-right 8px; background: white(90%); shape: circle; padding: 8px;
```

---

### 59. SearchableDropdown — Overlay Dropdown [WDROŻYĆ]

Dropdown z filtrowaniem i dual-mode (keyboard / arrow):

```typescript
// Overlay geometry
maxHeight: 240px; min: 100px
showAbove: availableBelow < maxHeight * 0.5
yOffset = showAbove ? -height - 4 : fieldHeight + 4

// Modes
dropdownMode: tap arrow → shows all, no keyboard
typingMode: focus → filter by query

// Backdrop scrim tylko w dropdownMode (tap outside dismisses)

// CompositedTransformFollower dla pozycji
```

---

### 60. GlassCard — Universal Card Container [WDROŻYĆ]

```typescript
// Standardowy container dla każdego card type
Container {
  color: white (lub custom)
  borderRadius: 20 (configurable)
  boxShadow: 0 2px 16px rgba(0,0,0,0.05)
  clipBehavior: antiAlias
  child: Material(transparent) > InkWell (ripple) > Padding > content
}
```

---

### 61. MetricCard Responsive Layout [WDROŻYĆ]

Auto-layout dla kart z jedną vs wieloma metrykami:

```typescript
// 1 metryka → full-width row
// 2+ metryki → 2-column grid (IntrinsicHeight dla równej wysokości)
// Odd last → full-width wide item
// Separator: column header bar 4×18px, primary color, radius 2
```

---

### 62. CharacterAvatar — Unified System [WDROŻYĆ]

```typescript
// Rozwiązanie avatara
isImageAvatar(avatar) = avatar contains '/' OR ends with image extension

if isImageAvatar → ClipOval > LocalImage (file path)
else → DiceBearAvatar (Notionists)

DiceBearAvatar:
  seed → diceBearUrl() → download SVG → local file cache
  render via SvgPicture.file
  loading: 30% size CircularProgressIndicator
  placeholder: circle, primary(10%) bg, person icon 50% size
  seed = avatar ?? "companion_{name}"
```

---

### 63. DetailPageLayout — Sticky Header Pattern [WDROŻYĆ]

Detail pages (ustawienia, analizy):

```typescript
// Stack layout
Scaffold bg: #F7F8FA
  Stack:
    CustomScrollView:
      SliverToBoxAdapter: topPadding + 56  // header clearance
      SliverToBoxAdapter: Padding(24, 0, 24, 120)  // generous bottom
    
    Positioned(top:0, left:0, right:0):  // sticky header
      Container(color: #F7F8FA):
        padding: fromLTRB(16, topPadding+8, 16, 12)
        Row: [AppBackButton] [Title 16px w700] [actions?]
```

---

### 64. MemexBrandTitle — Brand Text Pattern [WDROŻYĆ]

```typescript
// "Vanguard" branding pattern
RichText:
  "Vanguar" → textPrimary color
  "d" → primary color (last letter accent)
font: Bricolage Grotesque 32px w800

// Channel badge (obok nazwy)
Container: primary(8%) bg, border primary(22%), radius 5
padding: 6px H / 2px V
font: Inter 10px w700, primary color
```

---

## PODSUMOWANIE — CO OLAĆ

| Feature | Powód |
|---|---|
| Streaming transcriber / Silero VAD | Masz Telegram voice |
| Local file PKM (P.A.R.A. na disk) | Masz `vanguard_wiki_pages` |
| Multi-provider LLM switcher | Świadomie wybrałeś DeepSeek |
| RadialMenu (hold-to-record) | Flutter-only |
| Native MethodChannel calendar | React/Web → Google Calendar API bezpośrednio |
| LocalTaskExecutor + Workmanager | Masz Supabase cron + edge functions |
| Jieba CJK segmenter | Nie twój use case |
| Tavern character import | Nie twój use case |
| AgentBackgroundCoordinator | Masz Telegram push |
| PhotoSuggestion (MLKit) | Brak mobile app |
| Drift SQLite local DB | Masz Supabase |

---

*Plik wygenerowany: 2026-06-23. Źródło: 371 plików Dart z repozytorium memex-explore.*
*Wzorce: 64 total (Sekcje I-VIII). Wzorce do wdrożenia: ~50. Wzorce do olania: 11.*
