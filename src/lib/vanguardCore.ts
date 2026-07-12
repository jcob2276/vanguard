/**
 * VANGUARD CORE 2.0 - Unified Behavioral Engine (Frontend Wrapper)
 *
 * Wszystkie obliczenia i klasyfikacje zostały przeniesione do wspólnego
 * pliku shared pod adresem: supabase/functions/_shared/vanguardCore.ts.
 * Ten plik jedynie re-eksportuje te funkcje dla frontendu, zapobiegając duplikacji.
 *
 * @architecture-exception supabase/functions/_shared/vanguardCore.ts
 * Verified: pure TypeScript, no Deno-specific APIs (no esm.sh / deno.land / https:// imports).
 * The shared file is safe to re-export from src/ — it compiles with the standard TS toolchain.
 * Re-audit if dependencies of vanguardCore.ts or its transitive imports ever gain Deno deps.
 */

export { computeSignals, VanguardCore } from '../../supabase/functions/_shared/vanguardCore.ts';
