# Bot not responding

## Vanguard bot (`vanguard-telegram`)

### Symptom: no response at all

1. Check edge function logs for `vanguard-telegram`
2. Verify webhook is set: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
3. Webhook URL should point to: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/vanguard-telegram`
4. Check for **401** in logs → redeploy with `--no-verify-jwt`

### Symptom: "Słucham..." then silence (voice)

- Whisper timeout (30s) — check `OPENAI_API_KEY`
- Background processing died — vanguard-telegram returns 200 immediately; check logs for inner errors
- Oracle timeout on `?` or `!!` commands — try without `!!` (reasoner is slow)

### Symptom: reconciliation not triggering planning

- Check `daily_reconciliations.status = 'sent'` exists and is < 36h old
- After answer, `planning_status` should become `active`
- Planning closes with "koniec" / "done" / "gotowe"

## Dojo bot (`dojo-telegram`)

### Symptom: "Transkrybuję..." then nothing

1. Check logs for `dojo-telegram`
2. Common cause: **DB CHECK constraint** on `dojo_reps.status` or `rep_type`
3. Query: `SELECT * FROM dojo_reps ORDER BY created_at DESC LIMIT 5`
4. Query: `SELECT phase, current_day FROM dojo_runs WHERE phase != 'completed'`

### Symptom: duplicate "Transkrybuję..." messages

- Telegram webhook retry (function took > 30s)
- Fix: synchronous processing, return 200 only after completion
- Do NOT use `EdgeRuntime.waitUntil` for voice processing on Supabase

## Quick DB checks

```sql
-- Active dojo run
SELECT id, current_day, phase, attempts_on_day FROM dojo_runs
WHERE phase != 'completed' ORDER BY started_at DESC LIMIT 1;

-- Recent dojo reps
SELECT day, phase, status, created_at FROM dojo_reps
ORDER BY created_at DESC LIMIT 5;

-- Pending reconciliation
SELECT id, status, planning_status, date FROM daily_reconciliations
ORDER BY created_at DESC LIMIT 3;
```
