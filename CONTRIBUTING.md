# Contributing

Vanguard is intentionally conservative about behavioral and biometric claims.
Before adding or changing features, read:

- [docs/PRODUCT_PRINCIPLES.md](./docs/PRODUCT_PRINCIPLES.md)
- [docs/surface-contracts/BIOMETRICS.md](./docs/surface-contracts/BIOMETRICS.md)
- [supabase/functions/README.md](./supabase/functions/README.md)

## Development

```bash
npm install
npm run build
npm run oss:audit
```

`npm run typecheck` requires Deno.

## Contribution Rules

- Do not add a second friction pipeline.
- Do not let Oracle or Analyst write inferred facts into the evidence layer.
- Do not present missing, stale, or provisional biometric data as final.
- Do not add coaching or psychological claims without evidence and correction paths.
- Do not commit real user data, local exports, `.env`, or private project refs.

## Pull Request Checklist

- Build passes.
- Public-readiness audit passes or findings are explained.
- New Supabase functions are listed in `supabase/functions/README.md`.
- New schema changes have migrations.
- User-facing claims include source, window, and uncertainty where relevant.
