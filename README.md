# Vanguard OS

Vanguard OS is an evidence-based personal operating system prototype.

It combines daily planning, Telegram/voice capture, biometric integrations, and
LLM-assisted reflection into one loop. The core product principle is strict:
the system records behavior and measured signals; the user gives meaning.

Vanguard is not an AI therapist, personality profiler, or autonomous coach. It
is a longitudinal memory layer for noticing drift, friction, recovery, and the
gap between declared intent and actual behavior.

## What It Does

- Captures raw behavioral stream entries through Telegram and web surfaces.
- Runs a daily loop: morning brief, midday check, evening reconciliation, and tomorrow planning.
- Extracts friction events through one canonical pipeline with human correction gates.
- Integrates biometric and activity sources such as Oura, Yazio, Strava, workouts, and ActivityWatch.
- Computes deterministic daily strain/recovery/fueling signals.
- Gives LLMs structured evidence instead of letting them invent profile claims.

## Architecture

```text
Telegram / Web / Voice
        |
        v
vanguard_stream -> auto-classify -> friction_events
        |
        +-> daily reconciliation -> planning_summary
        +-> biometric sync -> daily_strain
        +-> Oracle / Analyst read-only reasoning context
```

Main stack:

- React + Vite frontend
- Supabase Postgres
- Supabase Edge Functions
- Telegram Bot API
- OpenAI/DeepSeek model calls
- Vercel deployment

## Core Guardrails

- Evidence layer and reasoning layer stay separate.
- Friction writes go through one path: `vanguard_stream -> vanguard-auto-classify`.
- Patterns need explicit evidence, count, confidence, and date range.
- Missing or provisional data must be shown as missing or provisional.
- LLM output must not mutate the evidence layer without user confirmation.

See [docs/PRODUCT_PRINCIPLES.md](./docs/PRODUCT_PRINCIPLES.md) and
[docs/surface-contracts/BIOMETRICS.md](./docs/surface-contracts/BIOMETRICS.md).

## Open Source Status

This repository is being prepared for public open-source release. Before
publishing, run the public-readiness checklist:

```bash
npm run oss:audit
```

Also read [docs/OPEN_SOURCE.md](./docs/OPEN_SOURCE.md). The current private
workspace may contain personal notes, local artifacts, or project-specific
deployment references that should not be published.

## Development

```bash
npm install
cp .env.example .env
npm run dev
```

Useful checks:

```bash
npm run build
npm run oss:audit
```

`npm run typecheck` requires Deno to be installed.

## License

MIT. See [LICENSE](./LICENSE).
