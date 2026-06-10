# Telegram webhook timeout

## Problem

Telegram webhooks wait max **30 seconds** for HTTP 200. If processing takes longer, Telegram retries the same `update_id`.

## Symptoms

- Duplicate "Transkrybuję..." / "Słucham..." messages
- Same voice note processed multiple times
- Partial state in DB (lock set but rep not saved)


Process **synchronously** — return 200 only after:
1. Whisper transcription
2. DB save
3. Feedback message sent

Do NOT use `EdgeRuntime.waitUntil` for voice processing on Supabase — background tasks are killed after response.

## Vanguard-specific note

`vanguard-telegram` returns 200 immediately and processes in background IIFE. This works for text stream capture but voice transcription runs inside the background block.

If voice hangs, user sees "Słucham..." with no follow-up — check logs for Whisper errors.

## Timing budget

| Step | Typical time |
|---|---|
| Telegram getFile + download | 1–3s |
| Whisper (2 min audio) | 5–15s |
| DeepSeek eval | 2–5s |
| DB writes | <1s |
| **Total** | 8–20s (within 30s limit) |

## If still timing out

- Split: send immediate ack, process via separate queue (future)
- Shorten audio or compress before Whisper
- Check OpenAI API latency

## Dedup (if retries happen)


Vanguard stream: dedup by `metadata.telegram_message_id`.
