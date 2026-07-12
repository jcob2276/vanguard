/**
 * S5: Rozbieżność narracja vs biometria (Anty-Self-Deception).
 * Wykrywa dni, w których użytkownik skarży się na zmęczenie/niewyspanie,
 * mimo że biometria (sen >= 6.8h i readiness >= 65) wskazuje na pełną fizyczną regenerację.
 */

import { safeExecute } from '../supabase.ts';
import { getWarsawDateString } from '../time.ts';
import type { PatternInsight } from './types.ts';

export async function detectNarrativeBiometricMismatch(
  supabase: any,
  userId: string,
  options: { lookbackDays?: number } = {}
): Promise<PatternInsight[]> {
  const lookback = options.lookbackDays ?? 14;
  // Warsaw-calendar cutoff, not the UTC date of (now - N days) — `date` columns here hold
  // Warsaw calendar dates, and near midnight the UTC date can lag a full day behind Warsaw's.
  const cutoff = getWarsawDateString(new Date(Date.now() - lookback * 24 * 3600 * 1000));

  // 1. Pobierz daily_reconciliations z ostatnich N dni
  const recs = await safeExecute(
    supabase
      .from('daily_reconciliations')
      .select('date, user_response, p2_parsed')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .order('date', { ascending: true })
  );

  // 2. Pobierz aggregates z ostatnich N dni
  const aggs = await safeExecute(
    supabase
      .from('vanguard_daily_aggregates')
      .select('date, sleep_hours, readiness_score')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .order('date', { ascending: true })
  );

  if (!recs || recs.length === 0 || !aggs || aggs.length === 0) return [];

  // Map aggregates by date
  const aggMap = new Map<string, { sleep_hours: number | null; readiness_score: number | null }>();
  for (const a of aggs) {
    aggMap.set(a.date, { sleep_hours: a.sleep_hours, readiness_score: a.readiness_score });
  }

  const mismatchDates: Array<{ date: string; sleep: number; readiness: number; declared: string }> = [];

  const tiredKeywords = [/zmęczen/i, /zmęczo/i, /brak.*sił/i, /słab.*sen/i, /niewyspa/i, /padam/i, /wykończo/i, /padnię/i];

  for (const r of recs) {
    const textToCheck = `${r.user_response || ''} ${(r.p2_parsed as Record<string, unknown>)?.biggest_cost || ''}`;
    const mentionsTiredness = tiredKeywords.some(kw => kw.test(textToCheck));

    if (mentionsTiredness) {
      const agg = aggMap.get(r.date);
      if (agg && agg.sleep_hours != null && agg.readiness_score != null) {
        if (agg.sleep_hours >= 6.8 && agg.readiness_score >= 65) {
          const declaredCost = String((r.p2_parsed as Record<string, unknown>)?.biggest_cost ?? '');
          mismatchDates.push({
            date: r.date,
            sleep: agg.sleep_hours,
            readiness: agg.readiness_score,
            declared: declaredCost.trim() || r.user_response?.substring(0, 60) || ''
          });
        }
      }
    }
  }

  if (mismatchDates.length === 0) return [];

  const lastMismatch = mismatchDates[mismatchDates.length - 1];
  const count = mismatchDates.length;

  const evidenceText = count === 1
    ? `Dnia ${lastMismatch.date} zadeklarowałeś zmęczenie/niewyspanie ("${lastMismatch.declared.substring(0, 50)}..."), mimo że Twój sen wyniósł ${lastMismatch.sleep}h, a gotowość (readiness) wynosiła ${lastMismatch.readiness}. Może to wskazywać na zmęczenie psychiczne lub opór przed działaniem.`
    : `W ostatnich ${lookback} dniach odnotowaliśmy ${count} dni, w których zgłaszałeś zmęczenie lub brak energii, chociaż gotowość fizyczna (readiness >= 65) oraz sen (>= 6.8h) były na dobrym poziomie (np. dnia ${lastMismatch.date} przy gotowości ${lastMismatch.readiness}).`;

  return [{
    type: 'narrative_biometric_mismatch',
    title: 'Rozbieżność narracja vs biometria',
    evidenceText,
    confidence: 0.65 + Math.min(count * 0.08, 0.25),
    sampleSize: count,
    lastSeenDate: lastMismatch.date,
    metadata: {
      occurrences: count,
      mismatch_details: mismatchDates,
    }
  }];
}
