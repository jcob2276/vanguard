# Supabase Edge Functions registry (SSOT)

Project: configured per deployment through environment variables.

For the complete, auto-generated list of Edge Functions, their triggers, roles, status, read/write dependencies, and consumers, see:
👉 **[FUNCTIONS.md](./FUNCTIONS.md)**

---

## Data flow (canonical)

```text
Telegram / voice / vault
  -> vanguard_stream -> vanguard-auto-classify -> friction_events
       |                    (only friction path)
       +-> vanguard-architect (batch graph)
       +-> ingest-vault-log (long-form)
       +-> vanguard-wiki-compiler (derived compiled wiki)

Noon: vanguard-eval-interview -> reflective interview / thread-connecting question
Evening: vanguard-daily-reconciliation -> 24h voice/stream reflection prompt
Morning: autonomous brief/ping removed; planning is user-initiated in app/Oracle, not Telegram.

Nightly: vanguard-analyst -> RPC sync_friction_proposals -> system_proposals (confirmed friction N>=3 / 7d Warsaw)
Read: vanguard-oracle, briefing, synthesis, analyst -> stream 72h first + confirmed_friction_events VIEW + derived vanguard_wiki_pages
Frontend: Week Hub + Action Center resolve pending system_proposals (Istotne / Olej)
```

---

## `vanguard-telegram` Handler Map

Edit **one handler per change**. Webhook entry is a thin router (~35 LOC). The full Telegram subsystem is no longer small; keep changes handler-scoped and avoid broad rewrites.

| Area | Path | Role |
|------|------|------|
| Webhook entry | `index.ts` | Parse payload, auth `chat_id`, dispatch |
| Callback router | `_router/callbacks.ts` | Button clicks -> handlers |
| Message pipeline | `_router/messages.ts` | Stream, voice, Oracle, reconciliation routing |
| Config | `_router/config.ts` | `createTelegramContext()` |
| Reconciliation | `_handlers/reconciliation.ts` | Evening reflection reply (Telegram fast path) |
| Feedback buttons | `_handlers/feedback.ts` | `fb_ok` / `fb_err` |
| Anti-analysis guard | `_handlers/antiAnalysis.ts` | Analysis drift buttons |
| Telegram API | `_shared/telegram.ts` | send, callbacks, getFile (no raw `fetch` in handlers) |

---

## `_shared/` Helpers (Kernel)

| Module | Exports | Use when |
|--------|---------|----------|
| `supabase.ts` | `createServiceClient`, `safeExecute`, `requireEnv`, `resolveUserScope` | **All** DB access and user-token scope checks |
| `auth.ts` | `requireServiceRole` | Authorize service role key on cron/DB trigger edge functions |
| `constants.ts` | `getVanguardUserId` | Single-user default ID |
| `time.ts` | `getWarsawDateString`, `getWarsawDayBoundaries`, `getStreamCutoffs` | Warsaw day ranges |
| `streamContext.ts` | `fetchBriefingStreamLayers`, `fetchOracleStreamSlices`, formatters | Stream context (current-first) |
| `telegram.ts` | `sendMessage`, `sendMessageParsed`, `answerCallbackQuery`, `clearInlineKeyboard`, `getTelegramFilePath`, `sendChatAction` | All Telegram Bot API from functions |
| `deepseek.ts` | `deepseekChat`, `parseJsonFromContent` | New DeepSeek calls |
| `vanguardCore.ts` | `VanguardCore`, `computeSignals` | `save-daily-aggregate`, frontend |

---

## Do Not Build

Without explicit user approval + PRODUCT_PRINCIPLES feature gate:

- Second friction pipeline (architect/telegram/oracle writing `friction_events`)
- Oracle auto-save to `vanguard_knowledge` / `vanguard_entity_links` on chat
- Shadow engine, manifestation tracker, pendulum detector
- Parallel `fetch(api.telegram.org/...)` outside `_shared/telegram.ts`
- `EdgeRuntime.waitUntil` for DB writes that must complete before HTTP 200
- HTTP **200** with `{ error }` on failure

---

## Deploy Checklist

1. Update function metadata in its JSDoc header at the top of `index.ts`.
2. Run `npm run registry:generate` to regenerate `FUNCTIONS.md` and check for any JSDoc mismatches.
3. Make sure `verify_jwt` in `config.toml` matches trigger configuration.
4. Deploy; cron/webhook/Telegram -> `--no-verify-jwt`
5. Logs: no **401** within 5 minutes.
6. Telegram: one test message on touched flows.

Post-deploy smoke: `npm run smoke` (with `SUPABASE_SERVICE_ROLE_KEY` to test auth checks).
See `docs/runbooks/post-deploy-smoke.md`.
