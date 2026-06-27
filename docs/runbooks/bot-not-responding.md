# Bot not responding

## Vanguard bot (`vanguard-telegram`)

### Symptom: no response at all (text, voice, buttons)

1. Check edge function logs for `vanguard-telegram`
2. **503 `Webhook secret not configured`** → set `TELEGRAM_WEBHOOK_SECRET` in Supabase secrets, then re-register webhook (see below)
3. **403 on webhook** → Telegram `secret_token` ≠ Supabase `TELEGRAM_WEBHOOK_SECRET`, or webhook URL had `?apikey=` appended (wrong)
4. Verify webhook: `getWebhookInfo` — `last_error_message`, `pending_update_count`
5. Re-register (authenticated POST to edge function):

```bash
curl -X POST "$SUPABASE_URL/functions/v1/vanguard-telegram" \
  -H "Authorization: Bearer $SB_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fix_webhook":true}'
```

6. Webhook URL must be exactly: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/vanguard-telegram` (**no** `?apikey=` query string)
7. Check for **401** in logs → redeploy with `--no-verify-jwt`

### Symptom: "Słucham..." then silence (voice)

- Whisper timeout — check `OPENAI_API_KEY`
- Evening reflection path exceeded Telegram 30s webhook (embedding + 3× LLM) — use `telegramFastPath` in `reconciliation.ts`
- Telegram retry after partial save: idempotency on `vanguard_stream` used to return silently while `daily_reconciliations.status` stayed `sent` — resend voice or wait for deploy with resume logic

### Symptom: reconciliation prompt sent, voice does nothing (no ack)

- Old bug: pending reconciliation skipped the "🎤 Słucham..." ack, then webhook timed out → user saw nothing
- Fix: always ack voice; fast reconciliation path; resume if stream row exists but reconciliation still `sent`

### Symptom: "Transkrybuję..." / "Refleksja — transkrybuję..." then nothing

- Check edge logs for Whisper/DeepSeek errors
- Check `daily_reconciliations.status` — if `sent` with `user_response` filled, resend voice to trigger resume

## Quick DB checks

```sql
-- Pending reconciliation
SELECT id, status, planning_status, date, user_response IS NOT NULL AS has_response, created_at
FROM daily_reconciliations
ORDER BY created_at DESC LIMIT 3;

-- Stuck voice (stream saved, reconciliation not answered)
SELECT s.id, s.content, s.metadata->>'reconciliation_id' AS recon_id, r.status
FROM vanguard_stream s
LEFT JOIN daily_reconciliations r ON r.id = (s.metadata->>'reconciliation_id')::uuid
WHERE s.source = 'telegram'
  AND s.metadata->>'reconciliation_id' IS NOT NULL
ORDER BY s.created_at DESC LIMIT 5;
```

