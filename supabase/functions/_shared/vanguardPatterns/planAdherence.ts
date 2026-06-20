/**
 * S4: Plan adherence gap — rozjazd między tym, co zaplanowałeś wieczorem,
 * a tym co się realnie wydarzyło (p2 + friction + aggregates).
 *
 * W pierwszej wersji: patrzymy na wczorajszy plan vs dzisiejsze dane.
 */

import { safeExecute } from '../supabase.ts';
import type { PatternInsight } from './types.ts';

export async function detectPlanAdherenceGaps(
  supabase: any,
  userId: string,
  yesterdayDate: string
): Promise<PatternInsight[]> {
  // Pobierz wczorajszy plan + dzisiejsze p2 + friction + aggregate
  const [planRow, todayP2, todayFriction, todayAggregate] = await Promise.all([
    safeExecute(
      supabase
        .from('daily_reconciliations')
        .select('planning_summary, date')
        .eq('user_id', userId)
        .eq('date', yesterdayDate)
        .not('planning_summary', 'is', null)
        .maybeSingle()
    ),
    safeExecute(
      supabase
        .from('daily_reconciliations')
        .select('p2_parsed, date')
        .eq('user_id', userId)
        .gte('date', yesterdayDate) // dzisiaj lub jutro rano
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle()
    ),
    safeExecute(
      supabase
        .from('friction_events')
        .select('friction_type, event_kind, deviation, immediate_cost')
        .eq('user_id', userId)
        .gte('occurred_at', yesterdayDate + 'T00:00:00Z')
        .lt('occurred_at', yesterdayDate + 'T23:59:59Z')
        .in('event_kind', ['friction_event'])
        .limit(15)
    ),
    safeExecute(
      supabase
        .from('vanguard_daily_aggregates')
        .select('execution_score, final_state, identity_score')
        .eq('user_id', userId)
        .eq('date', yesterdayDate)
        .maybeSingle()
    ),
  ]);

  const plan = (planRow as any)?.planning_summary;
  if (!plan) return [];

  const prodArtifact = plan.production_artifact?.artifact || plan.one_clear_move;
  const tension = plan.tension_action?.action;

  if (!prodArtifact && !tension) return [];

  const p2 = (todayP2 as any)?.p2_parsed;
  const frictions = (todayFriction as any) || [];
  const agg = todayAggregate as any;

  const gaps: string[] = [];

  // Prosta heurystyka rozjazdu
  const hadBigCost = p2?.biggest_cost && p2.biggest_cost.length > 5;
  const highFriction = frictions.length >= 3;
  const badState = agg && (agg.final_state === 'CHAOS' || agg.final_state === 'AVOIDANCE' || (agg.execution_score ?? 1) < 0.4);

  if (prodArtifact && hadBigCost) {
    gaps.push(`zdefiniowałeś artefakt "${prodArtifact}", a wieczorem nazwałeś duży koszt`);
  }
  if (tension && highFriction) {
    gaps.push(`planowałeś ruch napięciowy, a pojawiło się ${frictions.length} tarć`);
  }
  if ((prodArtifact || tension) && badState) {
    gaps.push(`plan był konkretny, a dzień zakończył się w stanie ${agg?.final_state ?? 'słabym'}`);
  }
  if (p2?.day_score != null && p2.day_score <= 2 && (prodArtifact || tension)) {
    gaps.push(`planowałeś konkretnie, a oceniłeś dzień na ${p2.day_score}/5`);
  }

  if (gaps.length === 0) return [];

  const evidenceText =
    `Wczorajszy plan vs rzeczywistość: ${gaps.join(' + ')}. ` +
    `To nie jest ocena — po prostu powtarzający się schemat w Twoich danych.`;

  return [{
    type: 'plan_adherence_gap',
    title: 'Rozjazd plan vs wykonanie',
    evidenceText,
    confidence: 0.65 + Math.min(gaps.length * 0.1, 0.25),
    sampleSize: 1, // w tej wersji patrzymy na jeden dzień (agregujemy historycznie gdzie indziej)
    lastSeenDate: yesterdayDate,
    metadata: {
      prodArtifact,
      tension,
      p2BiggestCost: p2?.biggest_cost,
      frictionCount: frictions.length,
      finalState: agg?.final_state,
    },
  }];
}
