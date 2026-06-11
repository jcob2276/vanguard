## FEATURE:
[Opisz co chcesz zbudować — konkretnie, z wymaganiami funkcjonalnymi i technicznymi]

## EXAMPLES:
[Wskaż podobne pliki w projekcie, które pokazują wzorzec do naśladowania]
- np. `supabase/functions/compute-daily-strain/index.ts` — wzorzec auth guard + parallel processing
- np. `src/components/biometrics/DailyStrainCard.jsx` — wzorzec fetch z error propagation w UI

## DOCUMENTATION:
[Linki do zewnętrznych API/bibliotek, jeśli potrzebne]
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase JS Client: https://supabase.com/docs/reference/javascript

## OTHER CONSIDERATIONS:
[Gotchas, specyficzne wymagania, rzeczy które AI zwykle pomija]
- Warsaw timezone: zawsze `toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })` nie `.toISOString()`
- Auth: `resolveUserScope()` z `_shared/supabase.ts`, nie raw JWT parsing
- Frontend fetch: `throw` na `!response.ok` — nie ciche błędy
- User ID filter: każdy query musi mieć `.eq('user_id', ...)`
