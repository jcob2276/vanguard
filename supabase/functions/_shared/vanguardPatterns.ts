/**
 * vanguardPatterns.ts
 *
 * Etap 1 — Personal Pattern Memory (pierwsza warstwa detektorów).
 *
 * === MIGRACJA (czerwiec 2026) ===
 * Wzorce są teraz przechowywane w dedykowanej tabeli `vanguard_behavioral_patterns`
 * (migracja 20260602000001).
 * Poprzednio używaliśmy vanguard_curiosity_queue z category='behavioral_pattern' — to jest już legacy.
 *
 * Filozofia:
 * - Wszystko oparte na evidence (p2_parsed + friction_events + aggregates + planning_summary).
 * - Zawsze podajemy N + horyzont + pewność.
 * - Szanujemy dualizm.
 *
 * Plik podzielony (2026-06-20) na supabase/functions/_shared/vanguardPatterns/*.ts —
 * ten plik jest teraz tylko barrel re-exportem, żeby istniejące importy
 * `from '../_shared/vanguardPatterns.ts'` nie wymagały zmian.
 *
 * UWAGA: detectRecurringBlockers, detectPlanAdherenceGaps, detectMorningProtocolImpact,
 * detectSleepFrictionLink, detectEarlyWarningSignals, detectNarrativeBiometricMismatch
 * i recordBehavioralPattern nie są obecnie wywoływane z żadnego miejsca w repo
 * (sprawdzone 2026-06-20) — detektory zbudowane, nigdy niepodłączone do reconciliation.ts.
 */

export type { PatternInsight, BehavioralPattern } from './vanguardPatterns/types.ts';

export { detectRecurringBlockers } from './vanguardPatterns/blockers.ts';
export { detectPlanAdherenceGaps } from './vanguardPatterns/planAdherence.ts';
export { detectMorningProtocolImpact } from './vanguardPatterns/morningProtocol.ts';
export { detectSleepFrictionLink } from './vanguardPatterns/sleepFriction.ts';
export { detectEarlyWarningSignals } from './vanguardPatterns/earlyWarning.ts';
export { detectNarrativeBiometricMismatch } from './vanguardPatterns/narrativeMismatch.ts';

export {
  shouldSurfaceInsight,
  recordBehavioralPattern,
  getRecentStrongBehavioralPatterns,
  updatePatternFeedback,
  markPatternAsShown,
  getRecentEarlyWarnings,
} from './vanguardPatterns/store.ts';
