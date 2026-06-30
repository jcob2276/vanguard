import type { MonthFacts } from './monthReview';

export type MonthCarryPlan = {
  intention: string | null;
  commitment: string | null;
  cialo: string | null;
  duch: string | null;
  konto: string | null;
};

type MonthReviewCarry = {
  month_theme?: string | null;
  correction_note?: string | null;
  leverage_note?: string | null;
};

function weakestPillar(averages: MonthFacts['pillarAverages']): 'cialo' | 'duch' | 'konto' | null {
  const entries: Array<{ pillar: 'cialo' | 'duch' | 'konto'; score: number }> = [];
  for (const pillar of ['cialo', 'duch', 'konto'] as const) {
    const score = averages[pillar];
    if (score != null) entries.push({ pillar, score });
  }
  if (entries.length === 0) return null;
  entries.sort((a, b) => a.score - b.score);
  return entries[0].pillar;
}

function strongestPillar(averages: MonthFacts['pillarAverages']): 'cialo' | 'duch' | 'konto' | null {
  const entries: Array<{ pillar: 'cialo' | 'duch' | 'konto'; score: number }> = [];
  for (const pillar of ['cialo', 'duch', 'konto'] as const) {
    const score = averages[pillar];
    if (score != null) entries.push({ pillar, score });
  }
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.score - a.score);
  return entries[0].pillar;
}

/** Monthly close → weekly plan prefill (user edits everything). */
export function monthCarryToWeekPlan(
  review: MonthReviewCarry | null | undefined,
  monthFacts?: MonthFacts | null,
): MonthCarryPlan {
  const intention = review?.month_theme?.trim() || null;
  const commitment = review?.correction_note?.trim() || null;
  const leverage = review?.leverage_note?.trim() || null;

  const plan: MonthCarryPlan = {
    intention,
    commitment,
    cialo: null,
    duch: null,
    konto: null,
  };

  if (!monthFacts) return plan;

  const weak = weakestPillar(monthFacts.pillarAverages);
  const strong = strongestPillar(monthFacts.pillarAverages);

  if (weak && commitment) plan[weak] = commitment;
  if (strong && leverage && strong !== weak) plan[strong] = leverage;

  return plan;
}
