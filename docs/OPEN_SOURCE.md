# Open Source Readiness

This document defines what must be true before publishing Vanguard publicly.

## Recommended Public Shape

Publish Vanguard as an open-source reference implementation for:

- evidence-based personal operating systems
- Telegram-first daily planning loops
- biometric-aware self-observation
- strict separation between evidence and LLM reasoning
- deterministic daily strain/recovery/fueling surfaces

Do not publish it as a polished consumer health app or therapy/coaching system.

## Must Remove Or Generalize Before Publishing

- Real `.env` files and local Supabase temp files.
- Real user IDs, Telegram chat IDs, project refs, and webhook URLs.
- Personal affirmations, voice scripts, run exports, food logs, calendar data, and ActivityWatch exports.
- Local Windows paths containing private usernames.
- Any document that describes one named person's private life unless rewritten as generic product context.
- Legacy documents that contradict current guardrails.

## Public-Friendly Assets

Safe to publish after review:

- source code
- migrations that do not hardcode private project URLs
- product principles and architecture docs with private names removed
- synthetic screenshots
- synthetic seed data
- runbooks with placeholders instead of real project refs

## OpenAI Codex For Open Source Application Notes

The strongest application angle is not "personal productivity app".

Use this framing:

> Vanguard OS is an open-source reference architecture for evidence-first
> personal AI systems. It shows how to separate behavioral evidence from LLM
> reasoning, how to prevent semantic inflation, and how to build daily loops
> that expose missing/provisional data instead of inventing insight.

Mention concrete maintainership work:

- Supabase Edge Function registry
- biometric surface contracts
- Telegram/webhook daily loop
- data provenance and missing-data UI
- security/privacy checklist for sensitive personal systems

## Pre-Publish Checklist

Run:

```bash
npm run oss:audit
npm run build
```

Then manually inspect:

- `README.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- `docs/`
- `scripts/`
- `supabase/migrations/`
- `supabase/functions/README.md`

Do not publish until `npm run oss:audit` has no high-signal findings or every
finding is intentionally documented.
