/**
 * S2: Morning protocol impact (Etap 1)
 *
 * Detektor analizuje wpływ porannego protokołu (first_90_protected + phone_first)
 * na wykonanie i stan następnego dnia na podstawie vanguard_daily_aggregates.
 *
 * Aktywowany w reconciliation.ts razem z S1 i S4.
 */

import { safeExecute } from '../supabase.ts';
import { getWarsawDateString } from '../time.ts';
import type { PatternInsight } from './types.ts';

export async function detectMorningProtocolImpact(
  supabase: any,
  userId: string,
  options: { lookbackDays?: number } = {}
): Promise<PatternInsight[]> {
  const lookback = options.lookbackDays ?? 25;

  // Warsaw-calendar cutoff, not the UTC date of (now - N days) — see narrativeMismatch.ts.
  const cutoff = getWarsawDateString(new Date(Date.now() - lookback * 24 * 3600 * 1000));

  // Pobierz reconciliations z first_90_protected + operational_facts (phone_first)
  const recs = await safeExecute(
    supabase
      .from('daily_reconciliations')
      .select('date, first_90_protected, planning_summary')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .not('first_90_protected', 'is', null)
      .order('date', { ascending: true })
  );

  if (!recs || recs.length === 0) return [];

  const insights: PatternInsight[] = [];

  for (let i = 0; i < recs.length - 1; i++) {
    const todayRec = recs[i];
    const nextDate = recs[i + 1].date; // bierzemy następny dzień z danych, niekoniecznie +1 kalendarzowo

    const first90Protected = todayRec.first_90_protected;
    const ops = ((todayRec.planning_summary as Record<string, unknown>)?.operational_facts as Record<string, unknown>) || {};
    const phoneFirst = ops.phone_first === true;

    // Pobierz aggregate następnego dnia
    const nextAgg = await safeExecute(
      supabase
        .from('vanguard_daily_aggregates')
        .select('execution_score, identity_score, final_state')
        .eq('user_id', userId)
        .eq('date', nextDate)
        .maybeSingle()
    );

    if (!nextAgg) continue;

    const exec = nextAgg.execution_score;
    const ident = nextAgg.identity_score;
    const state = nextAgg.final_state;

    // Prosta heurystyka wpływu
    let signal = '';
    if (first90Protected === false || phoneFirst) {
      if (exec != null && exec < 0.45) {
        signal = `pierwsze 90 przerwane / telefon pierwszy → niskie wykonanie następnego dnia (${Math.round(exec * 100)}%)`;
      } else if (state && ['CHAOS', 'AVOIDANCE', 'CONSUMING'].includes(state)) {
        signal = `pierwsze 90 przerwane / telefon pierwszy → następny dzień w stanie ${state}`;
      } else if (ident != null && ident < 60) {
        signal = `pierwsze 90 przerwane / telefon pierwszy → niski identity score następnego dnia (${ident})`;
      }
    }

    if (signal) {
      insights.push({
        type: 'morning_protocol_impact',
        title: 'Wpływ porannego protokołu na następny dzień',
        evidenceText: signal,
        confidence: 0.65,
        sampleSize: 1,
        lastSeenDate: nextDate,
        metadata: {
          date: todayRec.date,
          first_90_protected: first90Protected,
          phone_first: phoneFirst,
          next_day_execution: exec,
          next_day_state: state,
        },
      });
    }
  }

  // Agreguj jeśli jest kilka podobnych sygnałów
  if (insights.length >= 3) {
    return [{
      type: 'morning_protocol_impact',
      title: 'Powtarzający się wpływ porannego protokołu',
      evidenceText: `W ${insights.length} przypadkach z ostatnich ${lookback} dni, przerwanie first 90 lub telefon jako pierwsza czynność poprzedzało wyraźnie słabsze wykonanie lub gorszy stan następnego dnia.`,
      confidence: 0.72,
      sampleSize: insights.length,
      lastSeenDate: insights[insights.length - 1].lastSeenDate,
      metadata: { occurrences: insights.length },
    }];
  }

  return insights.slice(0, 2);
}
