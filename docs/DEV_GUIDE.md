# Vanguard OS — Development Guide

> Zasada nadrzędna: **kod = dokumentacja = produkcja**. Jeśli któreś z trzech się rozjeżdża — napraw to w tym samym commicie.

---

## 1. Zanim cokolwiek zaczniesz

Przeczytaj w tej kolejności:
1. `AGENTS.md` — stan systemu, modele, reguły deploy
2. `.cursor/rules/vanguard-context.mdc` — filozofia i guardrails
3. `supabase/functions/README.md` — mapa funkcji z JWT i triggerami
4. `BACKLOG.md` — co jest znane jako broken, nie naprawiaj czegoś co jest już zaplanowane inaczej

Jeśli pracujesz przy Dojo: przeczytaj też `.cursor/rules/dojo-isolation.mdc` i **nie ruszaj** `vanguard-*`.

---

## 2. Jak dodać nową Edge Function

### Checklist — każdy punkt obowiązkowy:

```
[ ] 1. Plik: supabase/functions/<nazwa>/index.ts
[ ] 2. Model: deepseek-v4-flash (nie deepseek-chat, nie deepseek-v3)
[ ] 3. verify_jwt: ustal czy cron/webhook (false) czy frontend (true)
[ ] 4. Dodaj do supabase/functions/README.md (Purpose, Trigger, JWT, Key tables)
[ ] 5. Jeśli verify_jwt: false — dodaj do listy w AGENTS.md i vanguard-ops.mdc
[ ] 6. Dodaj do tabeli w docs/TECHNICAL.md sekcja 1.3
[ ] 7. Jeśli cron — dodaj do tabeli cron jobs (TECHNICAL.md sekcja 1.4)
[ ] 8. Deploy → sprawdź logi przez 5 minut → brak 401
```

### Wzorzec struktury funkcji:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // logika

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err: any) {
    console.error('[nazwa-funkcji] error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
```

---

## 3. Jak zmieniać istniejącą Edge Function

### Zanim zaczniesz:

- Przeczytaj plik od początku do końca — nie edytuj bez znajomości kontekstu
- `vanguard-telegram` to monolit (~60KB) — zmieniaj jeden flow na raz
- Sprawdź czy zmiana dotyczy Vanguard czy Dojo — nigdy nie mieszaj

### Po każdej zmianie zaktualizuj:

| Co zmieniłeś | Co zaktualizować |
|---|---|
| Model AI | `AGENTS.md` (sekcja Models), `vanguard-context.mdc` (Stack) |
| Nowa tabela w kodzie | `supabase/functions/README.md` (Key tables) |
| Zmiana verify_jwt | `supabase/functions/README.md`, `AGENTS.md`, `vanguard-ops.mdc` |
| Wyłączenie bloku kodu | Komentarz z datą i powodem w kodzie + wpis w `TECHNICAL.md` sekcja 1.3 |
| Nowy cron job | `TECHNICAL.md` sekcja 1.4 |
| Bug fix | `BACKLOG.md` (oznacz jako naprawione z numerem commitu) |

### Wyłączanie kodu (nie kasowanie):

Jeśli wyłączasz feature tymczasowo — **nigdy nie kasujesz, zostawiasz z komentarzem**:

```typescript
// DISABLED — Sprint 0.7 (2026-05-17)
// Powód: LLM mutował source-of-truth bez guardrails.
// Re-enable w Sprint 1 z explicit temporal guards.
// await supabase.from('vanguard_knowledge').insert(...)
```

---

## 4. Konwencja commitów

### Format:

```
<typ>: <co zrobiono i dlaczego> (nie "co" ale "dlaczego")

Opcjonalnie: szczegóły jeśli zmiana jest nieoczywista.
```

### Typy:

| Typ | Kiedy |
|---|---|
| `feat:` | Nowa funkcjonalność |
| `fix:` | Bug fix |
| `chore:` | Porządki, upgrade modelu, dead code removal |
| `docs:` | Tylko dokumentacja |
| `refactor:` | Zmiana kodu bez zmiany zachowania |
| `deploy:` | Deploy bez zmian kodu (rollback, config) |

### Przykłady dobrych commitów:

```
fix: correct Warsaw timezone in vanguard-telegram tomorrowDate calculation

chore: upgrade all Vanguard functions deepseek-chat → deepseek-v4-flash

feat: add closure proposals human gate — LLM cannot mutate stream directly

docs: sync function count and model names after 2026-05-23 deploy sprint
```

### Przykłady złych commitów:

```
fix: fixed bug                    ← co za bug?
update: various changes           ← jakie?
wip                               ← nie commituj WIP na main
```

---

## 5. Zasady AI w tym projekcie

### Modele — nie zmieniaj bez powodu:

| Gdzie | Model | Dlaczego |
|---|---|---|
| Wszystkie Vanguard functions | `deepseek-v4-flash` | Szybki, tani, wystarczający |
| Oracle tryb `!!` | `deepseek-reasoner` | Deep analysis na żądanie |
| Dojo eval | `deepseek-chat` | Intencjonalnie osobny — nie upgrade |
| Embeddings | `text-embedding-3-small` | Kompatybilność wektorów w DB |
| Whisper | `whisper-1` | Jedyna opcja |

**Nie upgrade'uj modelu jeśli nie testujesz zmiany.** Zmiana modelu = potencjalna zmiana outputu = potencjalny bug w downstream pipeline.

### LLM nie może mutować source-of-truth:

- `vanguard_stream` — jedyna kanoniczna ścieżka zapisu: Telegram bot → INSERT
- `friction_events` — jedyna kanoniczna ścieżka: `vanguard-auto-classify`
- `vanguard_entity_links` — jedyna kanoniczna ścieżka: `ingest-vault-log` lub `vanguard-architect`
- Oracle **tylko czyta** — nigdy nie pisze do bazy na podstawie odpowiedzi LLM

### Prompt engineering — zasady:

- Każda zmiana promptu = **opisz w komentarzu** co zmieniono i dlaczego
- Nie dodawaj psychoanalizy, interpretacji motywów, "wzorzec potwierdzony"
- Language guardrail: `N wystąpień` zamiast `zawsze/nigdy/typowe dla niego`
- Jeśli prompt zaczyna wracać do "Shadow Engine" stylistyki — cofnij zmianę

---

## 6. Dodawanie do bazy danych

### Przed każdym ALTER TABLE / CREATE TABLE:

1. Sprawdź czy tabela ma DDL w `/supabase/migrations/` — wiele tabel jest pre-existing bez DDL
2. Nowe tabele: zawsze przez migrację, nigdy przez Dashboard
3. RLS: każda nowa tabela dostaje RLS od razu (nie "zrobię później")
4. Sprawdź constrainty przed kodem — `planning_status` to `pending|active|completed`, nie `done`

### Wzorzec migracji:

```sql
-- Nazwa pliku: supabase/migrations/YYYYMMDDHHMMSS_opis.sql
-- Opis: Co zmieniono i dlaczego

ALTER TABLE vanguard_stream ADD COLUMN IF NOT EXISTS nowa_kolumna text;

-- RLS policy jeśli nowa tabela:
ALTER TABLE nowa_tabela ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their data" ON nowa_tabela
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role bypass" ON nowa_tabela
  FOR ALL TO service_role USING (true);
```

### Timezone — zawsze Warsaw:

```typescript
// Data lokalna (yyyy-MM-dd):
const today = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' })

// Display string:
const localTime = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })
```

Nigdy `new Date().toISOString().split('T')[0]` — to jest UTC, nie Warsaw.

---

## 7. Czego NIE robić

```
❌ Dodawać nowych AI capabilities bez przejścia przez feature gate (docs/PRODUCT_PRINCIPLES.md)
❌ Dawać LLM write access do vanguard_stream / friction_events bez human gate
❌ Tworzyć nowych tabel bez migracji + RLS
❌ Commitować API keys, JWT tokens, service role keys
❌ Hardkodować user_id (używaj env var VANGUARD_USER_ID)
❌ Deployować vanguard-telegram bez testu voice flow
❌ Ruszać dojo-* przy pracy na Vanguard (i odwrotnie)
❌ Zostawiać console.log z wrażliwymi danymi (tokeny, user_id w URL)
❌ Deployować bez sprawdzenia logów przez 5 minut po deploy
❌ Zmieniać model AI bez aktualizacji AGENTS.md
```

---

## 8. Po każdej sesji deweloperskiej

Przed zamknięciem — szybki checklist:

```
[ ] Wszystkie zmiany są commitowane z opisem "dlaczego"
[ ] supabase/functions/README.md zgadza się z kodem
[ ] AGENTS.md zgadza się z prod (modele, JWT lista, liczba funkcji)
[ ] BACKLOG.md zaktualizowany (nowe bugi lub naprawione oznaczone)
[ ] Brak stagowanych plików z secrets (.env, credentials)
```

---

*Ostatnia aktualizacja: 2026-05-23*
