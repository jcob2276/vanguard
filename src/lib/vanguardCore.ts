/**
 * VANGUARD CORE 2.0 - Unified Behavioral Engine (Frontend Wrapper)
 *
 * Wszystkie obliczenia i klasyfikacje zostały przeniesione do wspólnego
 * pliku shared pod adresem: supabase/functions/_shared/vanguardCore.ts.
 * Ten plik jedynie re-eksportuje te funkcje dla frontendu, zapobiegając duplikacji.
 */

export {  computeSignals, VanguardCore } from '../../supabase/functions/_shared/vanguardCore.ts';
