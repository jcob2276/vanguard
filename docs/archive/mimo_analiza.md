# Mimo Analiza — Audyt Vanguard (zweryfikowany)

**Data:** 2026-06-26  
**Weryfikacja:** ręczny przegląd kodu źródłowego (2026-06-26)  
**Poprzedni audyt:** `docs/audits/AUDYT-LOGICZNY-2026-06-25.md`

Ten dokument zawiera **tylko potwierdzone** findings. Usunięto pozycje niezgodne z kodem, duplikaty i „ulepszenia”, które są świadomym MVP/deferred.

---

## Priorytet 1 — Security (naprawić)

### 1.1 IDOR w `sync-oura`
**Plik:** `supabase/functions/sync-oura/index.ts`

Funkcja bierze `userId` z body bez `resolveUserScope()`. Gateway ma `verify_jwt: true`, więc anon nie wejdzie — ale zalogowany user może podać cudze `userId` i odczytać token Oura ofiary.

**Fix:** `resolveUserScope(req, body.userId)` jak w `sync-oura-enhanced`.

---

### 1.2 Webhook secret bypass
**Plik:** `supabase/functions/vanguard-telegram/index.ts:7-11`

Gdy `TELEGRAM_WEBHOOK_SECRET` jest pusty → `verifyTelegramSecret` zwraca `true`. Webhook otwarty na fałszywe payloady.

**Fix:** Brak secreta = odrzucaj request (503/401), nie `return true`.

---

### 1.3 Zły secret zwraca 200 OK
**Plik:** `supabase/functions/vanguard-telegram/index.ts:76-78`

Mismatch secreta → `200 "OK"`. Telegram uznaje delivery za sukces; w logach wygląda jak OK.

**Fix:** `403 Forbidden`.

---

### 1.4 SSRF w savedLinks
**Plik:** `supabase/functions/vanguard-telegram/_handlers/savedLinks.ts`

`fetch(url)` na URL od użytkownika bez walidacji (RFC1918, localhost, metadata IP).

**Fix:** Allowlista schematów + blokada prywatnych IP / linków wewnętrznych.

---

### 1.5 `JSON.parse` zamiast `parseJsonFromContent`
**Plik:** `supabase/functions/vanguard-telegram/_handlers/savedLinks.ts:92`

DeepSeek często owija JSON w markdown mimo `response_format: json_object`. Reszta codebase używa `parseJsonFromContent`.

**Fix:** Import z `_shared/deepseek.ts`.

---

### 1.6 Zduplikowany auth w `rescore-workout-sessions`
**Plik:** `supabase/functions/rescore-workout-sessions/index.ts:13-33`

Lokalne kopie `createServiceClient()` i `resolveUserScope()` zamiast `_shared/supabase.ts`.

**Fix:** Import ze shared.

---

### 1.7 Oracle: `current_query` bez sanitizacji
**Plik:** `supabase/functions/vanguard-oracle/index.ts:887`

`state_vector` i `user_conf` przechodzą przez `promptSanitize`; `current_query` idzie raw do LLM. Ryzyko injection przez treść w query (mniej krytyczne niż server-side SSRF, ale realne).

**Fix:** `sanitizeUserConf(current_query)` lub dedykowany limit długości + strip control chars.

---

## Priorytet 2 — Logika (bugi użytkownika)

### 2.1 Suplementy: sukces mimo błędu DB
**Plik:** `supabase/functions/vanguard-telegram/_handlers/supplements.ts:90-117`

`logSupplement()` przy błędzie fetch/insert tylko `console.error` i `return`. Caller zawsze pokazuje „✅ Zalogowano!”.

**Fix:** Propagacja błędu do callback handlera.

---

### 2.2 Knowledge mode: obie gałęzie identyczne
**Plik:** `supabase/functions/vanguard-telegram/_router/messages.ts:501-514`

Komentarz w `else`: „krótkie notatki zostają w streamie”. Kod ustawia `deferredVaultIngest` tak samo jak w `if`. Każda notatka ## idzie przez `ingest-vault-log`.

**Fix:** W `else`: `deferredVaultIngest = null`.

---

### 2.3 Saturday check-in: artifact = tension
**Plik:** `supabase/functions/vanguard-telegram/_handlers/saturdayCheckin.ts:217-220`

`tomorrowArtifact` i `tomorrowTension` ustawiane z tego samego pola adversary. Dwa różne koncepty w planie mają identyczną wartość.

**Fix:** Artifact z odpowiedzi użytkownika (lub osobne pole z adversary).

---

### 2.4 Truncation przed chunkingiem Telegram
**Plik:** `supabase/functions/vanguard-telegram/_router/messages.ts:624`

Oracle response obcinany do 4000 znaków zanim trafi do `safeSendTelegram` (który sam chunkuje).

**Fix:** Usunąć truncation; zostawić chunker.

---

### 2.5 `userId!` bez guarda
**Plik:** `supabase/functions/vanguard-telegram/index.ts:37`

`resolveUserScope` może zwrócić `null`; `handleSavedLinkDirect(..., userId!, ...)`.

**Fix:** Early return 400 gdy brak userId.

---

### 2.6 Oracle timeout 55s > Telegram webhook ~30s
**Plik:** `supabase/functions/vanguard-telegram/_router/messages.ts:588`

Ryzyko retry Telegrama i podwójnego przetwarzania tej samej wiadomości.

**Fix:** Timeout ≤25s albo async pattern poza webhookiem.

---

### 2.7 `mean()` zwraca 0 dla pustych tablic
**Plik:** `supabase/functions/vanguard-nutrition-coach/index.ts:25`

Brak danych Oura → „0.00h sleep” zamiast braku sygnału.

**Fix:** `null` dla pustych tablic (jak w `_shared/time.ts`).

---

### 2.8 Sauna query bez `user_id`
**Plik:** `supabase/functions/compute-illness-signal/index.ts:82-84`

`.ilike('exercise_name', 'sauna%')` bez scope na użytkownika. W multi-tenant sauny innych userów mogą wpływać na confoundery.

**Fix:** Join przez `workout_sessions.user_id` lub filtr po uid.

---

### 2.9 Push reminder: `reminder_sent` mimo failed delivery
**Plik:** `supabase/functions/vanguard-push-reminder/index.ts:71-84`

`Promise.allSettled` — wynik nie sprawdzany; `reminder_sent: true` zawsze po próbie.

**Fix:** Oznacz sent tylko gdy ≥1 notification OK.

---

### 2.10 `x.sort()` mutuje input
**Plik:** `supabase/functions/compute-correlations/index.ts:78`

`lagged()` sortuje przekazaną tablicę in-place. Kolejne korelacje na tym samym `series` widzą posortowane dane.

**Fix:** `[...x].sort(...)`.

---

## Priorytet 3 — Timezone

### 3.1 `nowWarsaw()` — parsowanie bez offsetu TZ
**Plik:** `src/lib/date.ts:55-67`

Buduje string z części Warsaw i robi `new Date(...)` bez strefy → interpretacja w **system timezone** przeglądarki, nie Warsaw. Na maszynie ≠ UTC daje drift.

**Fix:** Użyć istniejących helperów (`getTodayWarsaw`, `getWarsawDayBoundaries`) zamiast pseudo-Date.

---

### 3.2 `checkReEntryMode`: UTC midnight
**Plik:** `src/lib/dailyPlan.ts:88-89`

```ts
new Date(`${today}T00:00:00Z`)
```

To północ UTC, nie Warsaw. Przy granicach DST może dać off-by-one w liczeniu dni przerwy.

**Fix:** Anchoring na `T12:00:00Z` + Warsaw date string (pattern z reszty codebase).

---

### 3.3 `desktopUtils.ts`: brak `Z` w 4 miejscach
**Plik:** `src/components/desktop/desktopUtils.ts:33, 50, 118, 154`

`new Date(ds + 'T12:00:00')` parsowane lokalnie; linia 23 poprawnie ma `Z`.

**Fix:** Dodać `Z` wszędzie.

---

### 3.4 Saturday check-in: flat 7×86400000ms
**Plik:** `supabase/functions/vanguard-telegram/_handlers/saturdayCheckin.ts:111`

`Date.now() - 7 * 24 * 60 * 60 * 1000` — nie kalendarzowe 7 dni Warsaw (DST). W `messages.ts:547-548` jest już poprawny pattern.

**Fix:** Ujednolicić z `getWarsawDayBoundaries`.

---

## Priorytet 4 — Martwy kod (do usunięcia przy refactorze)

### 4.1 `src/components/widgets/` — 13 plików, zero importów w `src/`
BarChart, BubbleChart, CompositionCard, ContrastCard, GalleryCard, HighlightCard, MapCard, ProgressChart, RadarChart, RouteMapCard, SummaryCard, TimelineWidget, TrendChart.

### 4.2 UI bez referencji
- `src/components/ui/SharePosterDecorator.tsx`
- `src/components/ui/TimelineCommon.tsx`

*(BrandTitle, PersonaAvatarButton, CharacterAvatar — **używane** w `Dashboard.tsx`; agentRunMode — **używany** w `OracleCard.tsx`.)*

### 4.3 Backend
- `isValidServiceRoleToken()` w `_shared/supabase.ts` — zdefiniowana, nigdy wywoływana

### 4.4 Hooki
- `useDashboardData` zwraca `proteinToday`, `readiness`, `hasWorkoutToday` — `DesktopDashboard` ich nie destrukturyzuje

### 4.5 Nieużywana zmienna
- `messages.ts:176` — `_commandSource` zadeklarowane, nieużywane

---

## Priorytet 5 — Dokumentacja registry

5 funkcji **istnieje i jest wołana z frontendu**, ale **brak w** `supabase/functions/README.md`:

| Funkcja | Caller |
|---------|--------|
| `lookup-food` | `FoodEntryModal.tsx` |
| `vanguard-detect-patterns` | `PatternsView.tsx` |
| `vanguard-keep-triage` | `WeeklyReview.tsx` |
| `vanguard-kpi-suggest` | `WeeklyReview.tsx` |
| `vanguard-week-recap` | `Direction.tsx` |

`vanguard-graph-embedder` **jest** w README (status: manual) — nie orphan.

---

## Priorytet 6 — Ulepszenia (realne, nie bugi)

| # | Temat | Uzasadnienie |
|---|-------|--------------|
| 6.1 | `sync-oura` partial sync | Batch loop `throw` przy błędzie API → kolejne batche porzucone |
| 6.2 | Oracle gap detection | Brak komunikatu gdy Oura nie syncowała się kilka dni |
| 6.3 | `/cancel` dla flow Telegram | Brak komendy anulowania sesji (planning, ForceReply, Saturday) |
| 6.4 | `parse-food-nl` hardcoded profil | 168cm/74kg/2084kcal w system prompt zamiast `user_fundament` |
| 6.5 | `vanguard-kpi-suggest` Strava | `gte("created_at", ...)` zamiast `start_date` dla aktywności |
| 6.6 | `compute-daily-strain` mental load | Świadome MVP (`mentalLoad = null`) — **nie bug**, opcjonalne rozszerzenie |

---

## Usunięte z poprzedniej wersji (fałszywe / nieaktualne)

| Pozycja | Powód usunięcia |
|---------|-----------------|
| `nowWarsaw()` snippet z `toLocaleString('sv')` | Kod używa `Intl.DateTimeFormat.formatToParts` — bug realny, opis był błędny |
| Double-fire w `useNotifications.ts` | Kod **ustawia** `last_reminder_date`, nie usuwa; guard `!== today` działa |
| Martwy `BrandTitle`, `PersonaAvatarButton`, `CharacterAvatar` | Importowane w `Dashboard.tsx` |
| Martwy `agentRunMode.ts` | Importowany w `OracleCard.tsx` |
| `vanguard-graph-embedder` orphaned | Jest w README jako manual |
| TOCTOU `ingest-vault-log` → duplicate | Unique index `(user_id, raw_hash)` — race daje error insert, nie cichy duplikat |
| `closureProposal.ts` race | Nie zweryfikowane w kodzie; poza scope tego audytu |
| `compute-daily-strain` mental load jako bug | Komentarz w kodzie: świadome MVP |

---

## Podsumowanie

| Kategoria | Potwierdzone |
|-----------|--------------|
| Security | 7 |
| Logika | 10 |
| Timezone | 4 |
| Martwy kod | ~15 plików + 2 helpery |
| Brak w README | 5 funkcji |
| Ulepszenia (opcjonalne) | 5 (+ 1 deferred MVP) |

**Rekomendowana kolejność:** 1.1–1.3 (auth/webhook) → 2.1–2.2 (fałszywy sukces Telegram) → 3.1–3.3 (timezone frontend) → reszta według dotykanego flow.
