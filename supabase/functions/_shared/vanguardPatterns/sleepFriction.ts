/**
 * S3: Sen → następnego dnia dominujący typ tarcia (Etap 1)
 *
 * Prosty detektor korelacji między niskim snem (z aggregates)
 * a konkretnymi typami friction_events następnego dnia.
 *
 * Jeden z czterech wzorców wysokiego ROI z researchu (ETAP_1_RESEARCH...).
 * Kompletujemy czwórkę: S1 (blokery), S2 (poranny protokół), S3 (sen), S4 (plan adherence).
 */

import { safeExecute } from '../supabase.ts';
import type { PatternInsight } from './types.ts';

export async function detectSleepFrictionLink(
  supabase: any,
  userId: string,
  options: { lookbackDays?: number } = {}
): Promise<PatternInsight[]> {
  const lookback = options.lookbackDays ?? 30;

  const cutoff = new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString().split('T')[0];

  // Pobierz aggregates z sleep_hours
  const aggregates = await safeExecute(
    supabase
      .from('vanguard_daily_aggregates')
      .select('date, sleep_hours')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .not('sleep_hours', 'is', null)
      .order('date', { ascending: true })
  );

  if (!aggregates || aggregates.length === 0) return [];

  const frictionBySleep: Record<string, { lowSleep: number; normalSleep: number }> = {};

  for (let i = 0; i < aggregates.length - 1; i++) {
    const day = aggregates[i];
    const nextDate = aggregates[i + 1].date; // następny dzień z danymi

    const sleep = day.sleep_hours;
    if (sleep == null) continue;

    const isLowSleep = sleep < 6.5;

    // Pobierz friction_events następnego dnia
    const frictions = await safeExecute(
      supabase
        .from('friction_events')
        .select('friction_type')
        .eq('user_id', userId)
        .gte('occurred_at', nextDate + 'T00:00:00Z')
        .lt('occurred_at', nextDate + 'T23:59:59Z')
        .eq('event_kind', 'friction_event')
    );

    if (!frictions || frictions.length === 0) continue;

    for (const f of frictions) {
      const type = f.friction_type || 'other';
      if (!frictionBySleep[type]) {
        frictionBySleep[type] = { lowSleep: 0, normalSleep: 0 };
      }
      if (isLowSleep) {
        frictionBySleep[type].lowSleep++;
      } else {
        frictionBySleep[type].normalSleep++;
      }
    }
  }

  const results: PatternInsight[] = [];

  // Szukamy typów, które wyraźnie częściej pojawiają się po niskim śnie
  Object.entries(frictionBySleep).forEach(([type, counts]) => {
    const total = counts.lowSleep + counts.normalSleep;
    if (total < 4) return; // za mało danych

    const lowRatio = counts.lowSleep / total;
    if (lowRatio > 0.65 && counts.lowSleep >= 3) {
      results.push({
        type: 'sleep_friction_link',
        title: `Niski sen → ${type}`,
        evidenceText: `Po snach poniżej 6.5h u Ciebie wyraźnie częściej pojawia się friction typu ${type} następnego dnia (N=${total}, ${Math.round(lowRatio * 100)}% przypadków po niskim śnie).`,
        confidence: 0.68,
        sampleSize: total,
        lastSeenDate: null,
        metadata: { friction_type: type, low_sleep_count: counts.lowSleep },
      });
    }
  });

  return results.slice(0, 2);
}
